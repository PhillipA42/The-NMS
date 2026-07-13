from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from monitoring.models import Network, Region, County, SubCounty, Site, Contractor, IctOfficer


class NetworkPollingEndpointsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.network = Network.objects.create(name='OGN Test Network')
        self.region = Region.objects.create(network=self.network, name='Nyanza')
        self.county = County.objects.create(region=self.region, name='Migori')
        self.sub_county = SubCounty.objects.create(county=self.county, name='Uriri')

        Site.objects.create(
            name='Urgent Site',
            site_code='URI-URIRI-P5800',
            ip_address='192.168.1.10',
            current_status=True,
            sub_county=self.sub_county,
        )
        Site.objects.create(
            name='Down Site',
            site_code='URI-URIRI-C5900',
            ip_address='192.168.1.11',
            current_status=False,
            sub_county=self.sub_county,
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
            assigned_region='Nyanza',
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
