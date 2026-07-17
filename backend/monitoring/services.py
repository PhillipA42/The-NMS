import logging
import concurrent.futures
from django.utils import timezone
from django.db import transaction
from .models import Contractor, IctOfficer, SyncLog, Site, PingHistory
from .document_parser import parse_contacts_sheet
from .network_utils import ping_host
from .models import Network
import re

logger = logging.getLogger(__name__)


def update_site_ping_result(site, is_up, timestamp=None):
    """Persist a site's latest ping result and record the event in history."""
    timestamp = timestamp or timezone.now()
    site.current_status = is_up
    site.last_ping_time = timestamp
    site.save(update_fields=['current_status', 'last_ping_time'])
    PingHistory.objects.create(site=site, status=is_up, logged_at=timestamp)
    return site


def sync_contacts_from_sheet(spreadsheet_id: str, range_name: str = 'Sheet1!A:Z'):
    """
    Service function that fetches parsed contact data from the Google Sheets reader,
    and performs an upsert (update-or-insert) against the Contractor and IctOfficer models.
    Records are matched by email address.
    """
    logger.info(f"Starting contact sync from spreadsheet {spreadsheet_id}")
    contacts_data = parse_contacts_sheet(spreadsheet_id, range_name)
    
    if not contacts_data:
        logger.warning("No data retrieved to sync.")
        return 0, 0
    
    created_count = 0
    updated_count = 0
    
    # Use a transaction so that if something catastrophically fails mid-way, it doesn't leave partial sync
    with transaction.atomic():
        for row in contacts_data:
            if not row['is_valid']:
                logger.warning(f"Skipping invalid row {row['row_number']} due to errors: {row['errors']}")
                continue
                
            email = row['email'].lower()
            name = row['name']
            phone = row['phone']
            role = str(row['role']).lower()
            
            # Determine if this row belongs to an ICT Officer or a Contractor
            if 'officer' in role or 'ict' in role:
                # Upsert IctOfficer
                obj, created = IctOfficer.objects.update_or_create(
                    email=email,
                    defaults={
                        'name': name,
                        'phone': phone,
                        # Region would need to be extracted if added to parser, leaving as default here
                    }
                )
            else:
                # Upsert Contractor
                # We assume the 'role' column or missing column maps to the company name for Contractors 
                # based on general Sheet conventions
                company_name = row['role'] if row['role'] else "Unknown Company"
                
                obj, created = Contractor.objects.update_or_create(
                    email=email,
                    defaults={
                        'primary_contact': name,
                        'company_name': company_name,
                        'phone': phone,
                    }
                )
                
            if created:
                created_count += 1
            else:
                updated_count += 1
                
        # Log the timestamp of the sync completion
        sync_log, _ = SyncLog.objects.get_or_create(id=1)
        sync_log.contacts_last_synced_at = timezone.now()
        sync_log.save()
        
    logger.info(f"Sync complete. Created: {created_count}, Updated: {updated_count}.")
    return created_count, updated_count

def poll_sites_concurrently(max_workers=20):
    """
    Concurrent polling engine that iterates through sites, pings them,
    and performs database commits to update their status and log history.
    """
    sites = Site.objects.all()
    results = []

    # Detect network-level IPs stored in Network.description (allow users to store an IP there)
    networks = Network.objects.all()
    network_ip_map = {}
    ip_regex = re.compile(r"(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)(?:\.|$)){4}")
    for net in networks:
        if not net.description:
            continue
        m = ip_regex.search(net.description)
        if m:
            network_ip_map[net] = m.group(0)

    network_results = []

    # 1. Concurrent Polling Engine (sites + networks)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit site pings (only if ip present)
        future_to_site = {executor.submit(ping_host, site.device_ip_address): site for site in sites if site.device_ip_address}
        # Submit network pings
        future_to_network = {executor.submit(ping_host, ip): net for net, ip in network_ip_map.items()}

        # Gather site results
        for future in concurrent.futures.as_completed(future_to_site):
            site = future_to_site[future]
            try:
                is_up = future.result()
            except Exception as exc:
                logger.error(f'Site {site.name} generated an exception during ping: {exc}')
                is_up = False
            results.append((site, is_up))

        # Gather network results
        for future in concurrent.futures.as_completed(future_to_network):
            net = future_to_network[future]
            try:
                is_up = future.result()
            except Exception as exc:
                logger.error(f'Network {net.name} generated an exception during ping: {exc}')
                is_up = False
            network_results.append((net, is_up))
            
    # 2. Database Commits
    now = timezone.now()
    history_entries = []
    
    with transaction.atomic():
        for site, is_up in results:
            update_site_ping_result(site, is_up, timestamp=now)
            history_entries.append(
                PingHistory(site=site, status=is_up, logged_at=now)
            )
            
        if history_entries:
            PingHistory.objects.bulk_create(history_entries)
            
    logger.info(f"Polling completed for {len(results)} sites and {len(network_results)} networks.")
    return {
        'sites_polled': len(results),
        'networks_polled': len(network_results),
        'site_results': [(s.id, bool(up)) for s, up in results],
        'network_results': [(n.id, bool(up)) for n, up in network_results],
    }
