import logging
import concurrent.futures
from django.utils import timezone
from django.db import transaction
from .models import Contractor, IctOfficer, SyncLog, Site, PingHistory
from .document_parser import parse_contacts_sheet
from .network_utils import ping_host

logger = logging.getLogger(__name__)

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

    # 1. Concurrent Polling Engine
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_site = {executor.submit(ping_host, site.ip_address): site for site in sites}
        for future in concurrent.futures.as_completed(future_to_site):
            site = future_to_site[future]
            try:
                is_up = future.result()
            except Exception as exc:
                logger.error(f'Site {site.name} generated an exception during ping: {exc}')
                is_up = False
            results.append((site, is_up))
            
    # 2. Database Commits
    now = timezone.now()
    history_entries = []
    
    with transaction.atomic():
        for site, is_up in results:
            site.current_status = is_up
            site.last_ping_time = now
            site.save(update_fields=['current_status', 'last_ping_time'])
            
            history_entries.append(
                PingHistory(site=site, status=is_up, logged_at=now)
            )
            
        if history_entries:
            PingHistory.objects.bulk_create(history_entries)
            
    logger.info(f"Polling completed for {len(results)} sites.")
    return len(results)
