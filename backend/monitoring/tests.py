import io
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from monitoring.models import Network, Region, County, Site, Contractor, IctOfficer, PingHistory
from monitoring.serializers import ReportSiteSerializer
from monitoring.services import update_site_ping_result


class NetworkPollingEndpointsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.network = Network.objects.create(name='OGN Test Network')
        self.region = Region.objects.create(network=self.network, name='Nyanza')
        self.county = County.objects.create(region=self.region, name='Migori')

        Site.objects.create(
            name='Urgent Site',
            device_ip_address='192.168.1.10',
            current_status=True,
            county=self.county,
        )
        Site.objects.create(
            name='Down Site',
            device_ip_address='192.168.1.11',
            current_status=False,
            county=self.county,
        )

        Contractor.objects.create(
            company_name='Safaricom Business',
            primary_contact='Support Desk',
            email='support@safaricom.co.ke',
            phone='+254700000001',
            coverage_regions='Nyanza',
        )
        IctOfficer.objects.create(
            name='James Ochieng',
            email='j.ochieng@ogn.go.ke',
            phone='+254700000002',
            assigned_region=self.region,
        )

    def test_dashboard_and_escalation_polling_endpoints_are_available(self):
        summary_response = self.client.get(reverse('dashboard-summary'))
        region_response = self.client.get(reverse('region-status'))
        recent_down_response = self.client.get(reverse('recent-down'))
        escalation_response = self.client.get(reverse('escalation-data'))

        self.assertEqual(summary_response.status_code, 200)
        self.assertEqual(region_response.status_code, 200)
        self.assertEqual(recent_down_response.status_code, 200)
        self.assertEqual(escalation_response.status_code, 200)

        summary_payload = summary_response.json()
        self.assertEqual(summary_payload['total_sites'], 2)
        self.assertEqual(summary_payload['sites_up'], 1)
        self.assertEqual(summary_payload['sites_down'], 1)

        region_payload = region_response.json()
        self.assertGreaterEqual(len(region_payload), 1)

        recent_down_payload = recent_down_response.json()
        self.assertGreaterEqual(len(recent_down_payload), 1)

        escalation_payload = escalation_response.json()
        self.assertGreaterEqual(len(escalation_payload), 1)

    def test_endpoints_only_return_data_for_the_ogn_network(self):
        other_network = Network.objects.create(name='MPLS')
        other_region = Region.objects.create(network=other_network, name='Coast')
        other_county = County.objects.create(region=other_region, name='Mombasa')
        Site.objects.create(
            name='Other Network Site',
            current_status=True,
            county=other_county,
        )

        summary_response = self.client.get(reverse('dashboard-summary'))
        self.assertEqual(summary_response.status_code, 200)
        summary_payload = summary_response.json()
        self.assertEqual(summary_payload['total_sites'], 2)
        self.assertEqual(summary_payload['sites_up'], 1)
        self.assertEqual(summary_payload['sites_down'], 1)

        region_response = self.client.get(reverse('region-status'))
        self.assertEqual(region_response.status_code, 200)
        region_payload = region_response.json()
        region_names = [item['region_name'] for item in region_payload]
        self.assertEqual(region_names, ['Nyanza'])

    def test_clear_imported_data_endpoint_removes_imported_records(self):
        response = self.client.post(reverse('clear-imported-data'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Network.objects.count(), 0)
        self.assertEqual(Region.objects.count(), 0)
        self.assertEqual(County.objects.count(), 0)
        self.assertEqual(Site.objects.count(), 0)
        self.assertEqual(Contractor.objects.count(), 0)
        self.assertEqual(IctOfficer.objects.count(), 0)

    def test_clear_imported_data_endpoint_can_remove_a_specific_table(self):
        response = self.client.post(reverse('clear-imported-data'), {'table': 'sites'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Site.objects.count(), 0)
        self.assertEqual(Region.objects.count(), 1)
        self.assertEqual(County.objects.count(), 1)

    def test_clear_imported_data_endpoint_reads_table_name_from_form_body(self):
        response = self.client.post(
            reverse('clear-imported-data'),
            'table=sites',
            content_type='application/x-www-form-urlencoded',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Site.objects.count(), 0)
        self.assertIn('sites', response.json()['message'])

    def test_clear_imported_data_endpoint_accepts_browser_post_requests_without_csrf_token(self):
        browser_client = Client(enforce_csrf_checks=True)

        response = browser_client.post(reverse('clear-imported-data'), {'table': 'sites'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Site.objects.count(), 0)

    def test_csv_import_can_clear_a_target_table_before_importing(self):
        csv_content = 'site_code,name,county_name,region_name,network_name\nNEW-001,Replacement Site,Migori,Nyanza,OGN Test Network\n'
        uploaded_file = SimpleUploadedFile('sites.csv', csv_content.encode('utf-8'), content_type='text/csv')

        response = self.client.post(
            reverse('csv-import') + '?clear_table=sites',
            {'sites': uploaded_file},
            format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Site.objects.count(), 1)
        self.assertTrue(Site.objects.filter(name='Replacement Site').exists())

    def test_csv_import_reads_counties_from_common_headers(self):
        csv_content = 'County Name,Region Name,Network Name\nKisumu,Nyanza,OGN Test Network\n'
        uploaded_file = SimpleUploadedFile('counties.csv', csv_content.encode('utf-8'), content_type='text/csv')

        response = self.client.post(
            reverse('csv-import'),
            {'counties': uploaded_file},
            format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(County.objects.filter(name='Kisumu').count(), 1)
        self.assertTrue(Region.objects.filter(name='Nyanza').exists())

    def test_csv_import_imports_regions_without_network_column(self):
        csv_content = 'Region Name\nNyanza\n'
        uploaded_file = SimpleUploadedFile('regions.csv', csv_content.encode('utf-8'), content_type='text/csv')

        response = self.client.post(
            reverse('csv-import'),
            {'regions': uploaded_file},
            format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Region.objects.filter(name='Nyanza').count(), 1)
        self.assertEqual(response.json()['imported']['regions'], 1)

    def test_report_site_serializer_exposes_manifest_fields(self):
        site = Site.objects.create(
            name='Manifest Site',
            county=self.county,
            networkdevice='Router-01',
            device_ip_address='192.168.1.15',
            current_status=True,
            last_ping_time=timezone.now(),
        )

        payload = ReportSiteSerializer(site).data

        self.assertEqual(payload['network_name'], 'OGN Test Network')
        self.assertEqual(payload['county_name'], 'Migori')
        self.assertEqual(payload['site_name'], 'Manifest Site')
        self.assertEqual(payload['ip_address'], '192.168.1.15')
        self.assertEqual(payload['current_status'], True)
        self.assertIn('last_ping', payload)

    def test_sidebar_tree_exposes_a_region_fallback_when_regions_are_missing(self):
        fallback_network = Network.objects.create(name='Fallback Network')
        Region.objects.filter(name='Nyanza').delete()

        response = self.client.get(reverse('sidebar-tree'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload)
        self.assertEqual(payload[0]['name'], 'OGN')

    def test_sidebar_tree_uses_regions_from_the_regions_table(self):
        network = Network.objects.create(name='OGN')
        Region.objects.create(name='Nakuru', network=network)
        Region.objects.create(name='Nairobi', network=network)

        response = self.client.get(reverse('sidebar-tree'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload[0]['name'], 'OGN')
        
        # Navigate through regions
        region_names = [entry['name'] for entry in payload[0].get('regions', [])]

        self.assertIn('Nakuru', region_names)
        self.assertIn('Nairobi', region_names)

    def test_sidebar_tree_returns_no_regions_when_the_database_is_empty(self):
        Network.objects.all().delete()
        Region.objects.all().delete()
        County.objects.all().delete()

        response = self.client.get(reverse('sidebar-tree'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload[0]['name'], 'OGN')
        self.assertEqual(payload[0].get('regions', []), [])

    def test_sidebar_tree_uses_real_network_records_under_each_county(self):
        ogn_network = Network.objects.create(name='OGN')
        metro_network = Network.objects.create(name='Metro Core')
        region = Region.objects.create(network=ogn_network, name='Western')
        County.objects.create(region=region, name='Kakamega')

        response = self.client.get(reverse('sidebar-tree'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        region_payload = next(item for item in payload[0].get('regions', []) if item['name'] == 'Western')
        county_payload = next(item for item in region_payload.get('counties', []) if item['name'] == 'Kakamega')
        network_names = [item['name'] for item in county_payload.get('networks', [])]

        self.assertIn('OGN', network_names)
        self.assertIn('Metro Core', network_names)

    def test_update_site_ping_result_records_status_and_timestamp(self):
        site = Site.objects.get(name='Urgent Site')
        timestamp = timezone.now() - timedelta(minutes=5)

        updated_site = update_site_ping_result(site, False, timestamp=timestamp)

        self.assertFalse(updated_site.current_status)
        self.assertEqual(updated_site.last_ping_time, timestamp)
        self.assertTrue(PingHistory.objects.filter(site=site, status=False, logged_at=timestamp).exists())
