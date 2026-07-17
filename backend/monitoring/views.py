from collections import defaultdict

from django.db import transaction
from django.db.models import Count, Q
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .csv_import import clear_imported_data, import_csv_data
from .models import Contractor, County, IctOfficer, Network, PingHistory, Region, Site
from .serializers import (
    ContractorSerializer,
    DashboardSummarySerializer,
    EscalationDataSerializer,
    IctOfficerSerializer,
    RecentDownSiteSerializer,
    RegionStatusSerializer,
    ReportSiteSerializer,
    SidebarNetworkSerializer,
)
from .services import poll_sites_concurrently


class SidebarTreeView(generics.ListAPIView):
    """
    Returns a compact OGN tree backed by the Region table so the sidebar shows
    the region names you uploaded without loading the full network inventory.
    """
    queryset = Network.objects.none()
    serializer_class = SidebarNetworkSerializer

    def get(self, request, *args, **kwargs):
        # Get OGN network and its regions
        ogn_network = Network.objects.filter(name='OGN').prefetch_related('regions__counties').first()
        
        regions_payload = []
        if ogn_network:
            all_networks = [
                {
                    'id': network.id,
                    'name': network.name,
                    'sites': [],
                }
                for network in Network.objects.order_by('name').all()
            ]

            for region in ogn_network.regions.all():
                counties_payload = []

                for county in region.counties.all():
                    counties_payload.append({
                        'id': county.id,
                        'name': county.name,
                        'sites': [],
                        'networks': all_networks,
                    })

                regions_payload.append({
                    'id': region.id,
                    'name': region.name,
                    'counties': counties_payload,
                })

        payload = [{
            'id': 'ogn',
            'name': 'OGN',
            'regions': regions_payload,
        }]
        return Response(payload)


class ReportTableView(generics.ListAPIView):
    """
    Returns a flat list of Sites with full geographic context and descriptive names for the reports table.
    """
    queryset = Site.objects.select_related(
        'county',
        'county__region',
        'county__region__network',
        'contractor',
    ).filter(county__region__network__name__icontains='OGN')
    serializer_class = ReportSiteSerializer


class ContractorListView(generics.ListAPIView):
    """Returns the list of cached contractors."""
    queryset = Contractor.objects.filter(sites__county__region__network__name__icontains='OGN').distinct()
    serializer_class = ContractorSerializer


class IctOfficerListView(generics.ListAPIView):
    """Returns the cached ICT officers with their assigned region names."""
    queryset = IctOfficer.objects.select_related('assigned_region').filter(assigned_region__network__name__icontains='OGN')
    serializer_class = IctOfficerSerializer


class DashboardSummaryView(APIView):
    """Returns the headline KPI counts consumed by the dashboard cards."""

    def get(self, request):
        sites = self._get_ogn_sites()
        total_sites = sites.count()
        sites_up = sites.filter(current_status=True).count()
        sites_down = total_sites - sites_up
        uptime = round((sites_up / total_sites) * 100, 1) if total_sites else 0.0

        payload = {
            'total_sites': total_sites,
            'sites_up': sites_up,
            'sites_down': sites_down,
            'uptime': uptime,
        }
        return Response(DashboardSummarySerializer(payload).data)

    def _get_ogn_sites(self):
        return Site.objects.filter(county__region__network__name__icontains='OGN')


class CsvImportView(APIView):
    """Accepts CSV uploads for networks, regions, counties, contractors, ICT officers, and sites."""

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        files = {
            key: request.FILES.get(key)
            for key in ['networks', 'regions', 'counties', 'contractors', 'ict_officers', 'sites']
            if request.FILES.get(key) is not None
        }

        if not files:
            return Response(
                {'detail': 'No CSV files uploaded. Use the keys networks, regions, counties, contractors, ict_officers, sites.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        auto_poll = request.query_params.get('auto_poll', 'false').lower() in ['1', 'true', 'yes', 'on']
        clear_table = request.query_params.get('clear_table') or request.POST.get('clear_table')

        try:
            summary = import_csv_data(files, auto_poll=auto_poll, clear_table=clear_table)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'imported': summary, 'cleared_table': clear_table})


@method_decorator(csrf_exempt, name='dispatch')
class ClearImportedDataView(APIView):
    """Deletes all imported monitoring data and resets the database to an empty state."""

    def post(self, request):
        table_name = (
            request.query_params.get('table', '')
            or getattr(request, 'POST', {}).get('table', '')
            or getattr(request, 'data', {}).get('table', '')
            or request.GET.get('table', '')
            or ''
        )

        if not table_name:
            try:
                body = request.body.decode('utf-8', 'ignore') if hasattr(request, 'body') else ''
            except Exception:
                body = ''
            if body:
                for item in body.split('&'):
                    if '=' in item:
                        key, value = item.split('=', 1)
                        if key == 'table':
                            table_name = value
                            break

        if isinstance(table_name, list):
            table_name = table_name[0] if table_name else ''

        try:
            if table_name:
                deleted_counts = clear_imported_data(table_name)
                return Response({'cleared': deleted_counts, 'message': f'Imported monitoring data for {table_name} cleared successfully.'})

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

            return Response({'cleared': deleted_counts, 'message': 'Imported monitoring data cleared successfully.'})
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PollSitesView(APIView):
    """Triggers a live backend poll across all configured sites."""

    def post(self, request):
        result = poll_sites_concurrently()
        # result may be a dict with site/network counts
        if isinstance(result, dict):
            return Response({
                'polled_sites': result.get('sites_polled', 0),
                'polled_networks': result.get('networks_polled', 0),
                'site_results': result.get('site_results', []),
                'network_results': result.get('network_results', []),
                'message': f"Ping polling executed for {result.get('sites_polled', 0)} site(s) and {result.get('networks_polled', 0)} network(s).",
            })

        # fallback for older return types
        return Response({
            'polled_sites': int(result),
            'message': f'Ping polling executed for {int(result)} site(s).',
        })


class RegionStatusView(APIView):
    """Returns per-region up/down totals and computed availability scores."""

    def get(self, request):
        regions = Region.objects.filter(network__name__icontains='OGN').annotate(
            total_sites=Count('counties__sites', distinct=True),
            up_count=Count(
                'counties__sites',
                filter=Q(counties__sites__current_status=True),
                distinct=True,
            ),
            down_count=Count(
                'counties__sites',
                filter=Q(counties__sites__current_status=False),
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
            'county',
            'county__region',
            'contractor',
        ).filter(
            county__region__network__name__icontains='OGN',
            current_status=False,
        ).order_by('-last_ping_time', 'name')

        rows = []
        for site in sites:
            contractor = self._get_site_contractor(site)
            rows.append({
                'id': site.id,
                'site_code': site.name,
                'name': site.name,
                'region': site.county.region.name,
                'county': site.county.name,
                'contractor': contractor,
                'last_ping_time': site.last_ping_time,
            })

        return Response(RecentDownSiteSerializer(rows, many=True).data)

    def _get_site_contractor(self, site):
        if site.contractor:
            return site.contractor.company_name
        return self._resolve_contractors(site)

    def _resolve_contractors(self, site):
        region_name = site.county.region.name
        for contractor in Contractor.objects.all().order_by('company_name'):
            coverage_regions = contractor.coverage_regions or ''
            if region_name.lower() in coverage_regions.lower():
                return contractor.company_name
        return 'Unassigned'


class EscalationDataView(APIView):
    """Returns contractor + officer profiles grouped around current down sites."""

    def get(self, request):
        down_sites = Site.objects.select_related(
            'county',
            'county__region',
            'contractor',
        ).filter(
            county__region__network__name__icontains='OGN',
            current_status=False,
        ).order_by('name')

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
            region_name = site.county.region.name
            matched_contractor = self._match_contractor(region_name, contractors)
            contractor_key = matched_contractor.company_name if matched_contractor else 'Unassigned'

            contractor_groups[contractor_key]['contractor'] = contractor_key
            contractor_groups[contractor_key]['vendor_email'] = matched_contractor.email if matched_contractor else ''
            contractor_groups[contractor_key]['sites'].append({
                'id': site.id,
                'site_code': site.name,
                'name': site.name,
                'region': region_name,
                'county': site.county.name,
                'down_since': site.last_ping_time,
            })

            officers = IctOfficer.objects.filter(assigned_region=site.county.region)
            contractor_groups[contractor_key]['officers'] = [
                {
                    'id': officer.id,
                    'name': officer.name,
                    'email': officer.email,
                    'phone': officer.phone,
                    'role': officer.assigned_region.name if officer.assigned_region else '',
                }
                for officer in officers
            ]

        payload = list(contractor_groups.values())
        return Response(EscalationDataSerializer(payload, many=True).data)

    def _get_site_contractor(self, site):
        if site.contractor:
            return site.contractor.company_name
        return self._resolve_contractors(site)

    def _resolve_contractors(self, site):
        region_name = site.county.region.name
        for contractor in Contractor.objects.all().order_by('company_name'):
            coverage_regions = contractor.coverage_regions or ''
            if region_name.lower() in coverage_regions.lower():
                return contractor.company_name
        return 'Unassigned'

    def _match_contractor(self, region_name, contractors):
        for contractor in contractors:
            coverage_regions = contractor.coverage_regions or ''
            if region_name.lower() in coverage_regions.lower():
                return contractor
        return contractors[0]
