from collections import defaultdict

from django.db.models import Count, Q
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Contractor, IctOfficer, Network, Region, Site
from .serializers import (
    DashboardSummarySerializer,
    EscalationDataSerializer,
    RecentDownSiteSerializer,
    RegionStatusSerializer,
    ReportSiteSerializer,
    SidebarNetworkSerializer,
)


class SidebarTreeView(generics.ListAPIView):
    """
    Returns the nested tree structure of Networks -> Regions -> Counties -> SubCounties -> Sites.
    """
    queryset = Network.objects.all()
    serializer_class = SidebarNetworkSerializer


class ReportTableView(generics.ListAPIView):
    """
    Returns a flat list of Sites with full geographic context and descriptive names for the reports table.
    """
    queryset = Site.objects.select_related(
        'sub_county',
        'sub_county__county',
        'sub_county__county__region',
        'sub_county__county__region__network'
    ).all()
    serializer_class = ReportSiteSerializer


class DashboardSummaryView(APIView):
    """Returns the headline KPI counts consumed by the dashboard cards."""

    def get(self, request):
        total_sites = Site.objects.count()
        sites_up = Site.objects.filter(current_status=True).count()
        sites_down = total_sites - sites_up
        uptime = round((sites_up / total_sites) * 100, 1) if total_sites else 0.0

        payload = {
            'total_sites': total_sites,
            'sites_up': sites_up,
            'sites_down': sites_down,
            'uptime': uptime,
        }
        return Response(DashboardSummarySerializer(payload).data)


class RegionStatusView(APIView):
    """Returns per-region up/down totals and computed availability scores."""

    def get(self, request):
        regions = Region.objects.annotate(
            total_sites=Count('counties__sub_counties__sites', distinct=True),
            up_count=Count(
                'counties__sub_counties__sites',
                filter=Q(counties__sub_counties__sites__current_status=True),
                distinct=True,
            ),
            down_count=Count(
                'counties__sub_counties__sites',
                filter=Q(counties__sub_counties__sites__current_status=False),
                distinct=True,
            ),
        ).order_by('name')

        rows = []
        for region in regions:
            total_sites = region.total_sites or 0
            up_count = region.up_count or 0
            down_count = region.down_count or 0
            availability_score = round((up_count / total_sites) * 100, 1) if total_sites else 0.0

            rows.append({
                'region_name': region.name,
                'up_count': up_count,
                'down_count': down_count,
                'availability_score': availability_score,
            })

        return Response(RegionStatusSerializer(rows, many=True).data)


class RecentDownView(APIView):
    """Returns the most recently observed down sites for the recent-down panel."""

    def get(self, request):
        sites = Site.objects.select_related(
            'sub_county',
            'sub_county__county',
            'sub_county__county__region',
        ).filter(current_status=False).order_by('-last_ping_time', 'site_code')

        rows = []
        for site in sites:
            contractor = self._resolve_contractors(site)
            rows.append({
                'id': site.id,
                'site_code': site.site_code,
                'name': site.name,
                'region': site.sub_county.county.region.name,
                'county': site.sub_county.county.name,
                'contractor': contractor,
                'last_ping_time': site.last_ping_time,
            })

        return Response(RecentDownSiteSerializer(rows, many=True).data)

    def _resolve_contractors(self, site):
        region_name = site.sub_county.county.region.name
        for contractor in Contractor.objects.all().order_by('company_name'):
            coverage_regions = contractor.coverage_regions or ''
            if region_name.lower() in coverage_regions.lower():
                return contractor.company_name
        return 'Unassigned'


class EscalationDataView(APIView):
    """Returns contractor + officer profiles grouped around current down sites."""

    def get(self, request):
        down_sites = Site.objects.select_related(
            'sub_county',
            'sub_county__county',
            'sub_county__county__region',
        ).filter(current_status=False).order_by('site_code')

        contractor_groups = defaultdict(lambda: {
            'contractor': '',
            'vendor_email': '',
            'sites': [],
            'officers': [],
        })

        contractors = list(Contractor.objects.all().order_by('company_name'))
        if not contractors:
            contractors = [Contractor(company_name='Unassigned', email='')]

        for site in down_sites:
            region_name = site.sub_county.county.region.name
            matched_contractor = self._match_contractor(region_name, contractors)
            contractor_key = matched_contractor.company_name if matched_contractor else 'Unassigned'

            contractor_groups[contractor_key]['contractor'] = contractor_key
            contractor_groups[contractor_key]['vendor_email'] = matched_contractor.email if matched_contractor else ''
            contractor_groups[contractor_key]['sites'].append({
                'id': site.id,
                'site_code': site.site_code,
                'name': site.name,
                'region': region_name,
                'county': site.sub_county.county.name,
                'down_since': site.last_ping_time,
            })

            officers = IctOfficer.objects.filter(assigned_region__icontains=region_name)
            contractor_groups[contractor_key]['officers'] = [
                {
                    'id': officer.id,
                    'name': officer.name,
                    'email': officer.email,
                    'phone': officer.phone,
                    'role': officer.assigned_region,
                }
                for officer in officers
            ]

        payload = list(contractor_groups.values())
        return Response(EscalationDataSerializer(payload, many=True).data)

    def _match_contractor(self, region_name, contractors):
        for contractor in contractors:
            coverage_regions = contractor.coverage_regions or ''
            if region_name.lower() in coverage_regions.lower():
                return contractor
        return contractors[0]
