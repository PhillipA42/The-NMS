import csv
import io
import re
from django.db import transaction
from .models import Contractor, IctOfficer, Network, PingHistory, Region, County, Site
from .services import poll_sites_concurrently


def _reader(uploaded_file):
    uploaded_file.seek(0)
    raw_text = uploaded_file.read()
    try:
        decoded = raw_text.decode('utf-8-sig')
    except AttributeError:
        decoded = raw_text
    return csv.DictReader(io.StringIO(decoded))


def _clean(value):
    if value is None:
        return ''
    return str(value).strip()


def _normalise_key(key):
    if key is None:
        return ''
    normalized = str(key).strip().lower()
    normalized = re.sub(r'[^a-z0-9]+', '_', normalized)
    normalized = normalized.strip('_')
    return normalized


def _normalise_row(row):
    if not row:
        return {}
    return {_normalise_key(key): value for key, value in row.items()}


def _get_first_value(row, *keys):
    normalized_row = _normalise_row(row)
    for key in keys:
        value = _clean(normalized_row.get(_normalise_key(key)))
        if value:
            return value
    return ''


def _parse_bool(value):
    if value is None:
        return False
    normalized = str(value).strip().lower()
    return normalized in ['1', 'true', 'yes', 'y', 'on']


def _import_networks(reader):
    count = 0
    for raw_row in reader:
        row = _normalise_row(raw_row)
        name = _clean(row.get('name'))
        if not name:
            continue
        description = _clean(row.get('description'))
        Network.objects.update_or_create(
            name=name,
            defaults={'description': description},
        )
        count += 1
    return count


def _import_regions(reader):
    count = 0
    for raw_row in reader:
        row = _normalise_row(raw_row)
        name = _get_first_value(row, 'name', 'region_name', 'region')
        network_name = _get_first_value(row, 'network_name', 'network')
        if not name:
            continue

        network = None
        if network_name:
            network, _ = Network.objects.get_or_create(name=network_name)

        region_defaults = {'network': network} if network else {}
        Region.objects.update_or_create(
            name=name,
            defaults=region_defaults,
        )
        count += 1
    return count


def _import_counties(reader):
    count = 0
    for raw_row in reader:
        row = _normalise_row(raw_row)
        name = _get_first_value(row, 'name', 'county_name', 'county')
        region_name = _get_first_value(row, 'region_name', 'region')
        network_name = _get_first_value(row, 'network_name', 'network')
        if not name or not region_name:
            continue

        network = None
        if network_name:
            network, _ = Network.objects.get_or_create(name=network_name)

        region_defaults = {'network': network} if network else {}
        region, _ = Region.objects.get_or_create(name=region_name, defaults=region_defaults)
        County.objects.update_or_create(
            region=region,
            name=name,
        )
        count += 1
    return count


def _import_contractors(reader):
    count = 0
    for raw_row in reader:
        row = _normalise_row(raw_row)
        email = _clean(row.get('email'))
        if not email:
            continue
        company_name = _clean(row.get('company_name') or row.get('company')) or 'Unknown Contractor'
        primary_contact = _clean(row.get('primary_contact') or row.get('contact_name') or row.get('name'))
        phone = _clean(row.get('phone'))
        coverage_regions = _clean(row.get('coverage_regions'))
        Contractor.objects.update_or_create(
            email=email,
            defaults={
                'company_name': company_name,
                'primary_contact': primary_contact,
                'phone': phone,
                'coverage_regions': coverage_regions,
            },
        )
        count += 1
    return count


def _import_ict_officers(reader):
    count = 0
    for raw_row in reader:
        row = _normalise_row(raw_row)
        email = _clean(row.get('email'))
        if not email:
            continue
        name = _clean(row.get('name'))
        phone = _clean(row.get('phone'))
        region_name = _clean(row.get('assigned_region_name') or row.get('assigned_region') or row.get('region_name'))
        assigned_region = None
        if region_name:
            assigned_region, _ = Region.objects.get_or_create(name=region_name)
        IctOfficer.objects.update_or_create(
            email=email,
            defaults={
                'name': name,
                'phone': phone,
                'assigned_region': assigned_region,
            },
        )
        count += 1
    return count


def _resolve_site_relations(row):
    row = _normalise_row(row)
    network_name = _clean(row.get('network_name') or row.get('network'))
    region_name = _clean(row.get('region_name') or row.get('region'))
    county_name = _clean(row.get('county_name') or row.get('county'))
    if not county_name:
        raise ValueError('Site rows must include county_name or county.')

    network = None
    if network_name:
        network, _ = Network.objects.get_or_create(name=network_name)

    region = None
    if region_name:
        region, _ = Region.objects.get_or_create(name=region_name, defaults={'network': network})
    elif network:
        region, _ = Region.objects.get_or_create(name=county_name, defaults={'network': network})

    if not region:
        raise ValueError('Site rows must include region_name or region when importing sites.')

    county, _ = County.objects.get_or_create(region=region, name=county_name)

    contractor = None
    contractor_email = _clean(row.get('contractor_email') or row.get('contractor'))
    if contractor_email:
        contractor, _ = Contractor.objects.get_or_create(email=contractor_email)

    return county, contractor


def _import_sites(reader):
    count = 0
    for raw_row in reader:
        row = _normalise_row(raw_row)
        name = _clean(row.get('name'))
        if not name:
            continue

        county, contractor = _resolve_site_relations(row)
        networkdevice = _clean(row.get('networkdevice') or row.get('network_device') or row.get('device_name'))
        device_ip_address = _clean(row.get('device_ip_address') or row.get('ip_address') or row.get('device_ip')) or None
        current_status = _parse_bool(row.get('current_status') or row.get('status'))

        Site.objects.update_or_create(
            county=county,
            name=name,
            defaults={
                'networkdevice': networkdevice,
                'device_ip_address': device_ip_address,
                'contractor': contractor,
                'current_status': current_status,
            },
        )
        count += 1
    return count


def clear_imported_data(table_name=None):
    normalized_table = (table_name or '').strip().lower()

    if normalized_table in {'', 'all', 'all_tables', 'all_data'}:
        deleted_counts = {
            'networks': Network.objects.count(),
            'regions': Region.objects.count(),
            'counties': County.objects.count(),
            'sites': Site.objects.count(),
            'contractors': Contractor.objects.count(),
            'ict_officers': IctOfficer.objects.count(),
        }
        with transaction.atomic():
            PingHistory.objects.all().delete()
            Site.objects.all().delete()
            County.objects.all().delete()
            Region.objects.all().delete()
            Network.objects.all().delete()
            Contractor.objects.all().delete()
            IctOfficer.objects.all().delete()
        return deleted_counts

    if normalized_table == 'sites':
        deleted_counts = {'sites': Site.objects.count()}
        with transaction.atomic():
            PingHistory.objects.all().delete()
            Site.objects.all().delete()
        return deleted_counts

    if normalized_table == 'counties':
        deleted_counts = {'counties': County.objects.count()}
        with transaction.atomic():
            PingHistory.objects.all().delete()
            Site.objects.all().delete()
            County.objects.all().delete()
        return deleted_counts

    if normalized_table == 'regions':
        deleted_counts = {'regions': Region.objects.count()}
        with transaction.atomic():
            PingHistory.objects.all().delete()
            Site.objects.all().delete()
            County.objects.all().delete()
            Region.objects.all().delete()
        return deleted_counts

    if normalized_table == 'networks':
        deleted_counts = {'networks': Network.objects.count()}
        with transaction.atomic():
            PingHistory.objects.all().delete()
            Site.objects.all().delete()
            County.objects.all().delete()
            Region.objects.all().delete()
            Network.objects.all().delete()
        return deleted_counts

    if normalized_table == 'contractors':
        deleted_counts = {'contractors': Contractor.objects.count()}
        with transaction.atomic():
            Contractor.objects.all().delete()
        return deleted_counts

    if normalized_table == 'ict_officers':
        deleted_counts = {'ict_officers': IctOfficer.objects.count()}
        with transaction.atomic():
            IctOfficer.objects.all().delete()
        return deleted_counts

    raise ValueError(f'Unsupported table to clear: {table_name}')


def import_csv_data(files, auto_poll=False, clear_table=None):
    summary = {}
    with transaction.atomic():
        if clear_table:
            clear_imported_data(clear_table)

        if 'networks' in files:
            summary['networks'] = _import_networks(_reader(files['networks']))
        if 'regions' in files:
            summary['regions'] = _import_regions(_reader(files['regions']))
        if 'counties' in files:
            summary['counties'] = _import_counties(_reader(files['counties']))
        if 'contractors' in files:
            summary['contractors'] = _import_contractors(_reader(files['contractors']))
        if 'ict_officers' in files:
            summary['ict_officers'] = _import_ict_officers(_reader(files['ict_officers']))
        if 'sites' in files:
            summary['sites'] = _import_sites(_reader(files['sites']))

        if auto_poll and summary.get('sites', 0) > 0:
            summary['polled_sites'] = poll_sites_concurrently()

    return summary
