from rest_framework import serializers
from .models import Contractor, IctOfficer, Network, Region, County, Site

# ---------------------------------------------------------
# Sidebar Tree Serializers (Nested)
# ---------------------------------------------------------
class SidebarSiteSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source='name', read_only=True)

    class Meta:
        model = Site
        fields = ['id', 'label', 'name', 'networkdevice', 'device_ip_address', 'current_status']


class SidebarCountySerializer(serializers.ModelSerializer):
    sites = SidebarSiteSerializer(many=True, read_only=True)

    class Meta:
        model = County
        fields = ['id', 'name', 'sites']


class SidebarRegionSerializer(serializers.ModelSerializer):
    counties = SidebarCountySerializer(many=True, read_only=True)

    class Meta:
        model = Region
        fields = ['id', 'name', 'counties']


class SidebarNetworkSerializer(serializers.ModelSerializer):
    regions = serializers.SerializerMethodField()

    class Meta:
        model = Network
        fields = ['id', 'name', 'regions']

    def get_regions(self, obj):
        table_regions = list(Region.objects.all())
        if table_regions:
            return SidebarRegionSerializer(table_regions, many=True, context=self.context).data

        explicit_regions = list(obj.regions.all())
        if explicit_regions:
            return SidebarRegionSerializer(explicit_regions, many=True, context=self.context).data

        fallback_region_name = obj.name or 'OGN'
        fallback_region = {
            'id': None,
            'name': fallback_region_name,
            'counties': [],
        }
        return [fallback_region]


# ---------------------------------------------------------
# Dashboard / Polling Serializers
# ---------------------------------------------------------
class DashboardSummarySerializer(serializers.Serializer):
    total_sites = serializers.IntegerField()
    sites_up = serializers.IntegerField()
    sites_down = serializers.IntegerField()
    uptime = serializers.FloatField()


class RegionStatusSerializer(serializers.Serializer):
    region_name = serializers.CharField()
    up_count = serializers.IntegerField()
    down_count = serializers.IntegerField()
    availability_score = serializers.FloatField()


class RecentDownSiteSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    site_code = serializers.CharField()
    name = serializers.CharField()
    region = serializers.CharField()
    county = serializers.CharField()
    contractor = serializers.CharField()
    last_ping_time = serializers.DateTimeField(allow_null=True)


class EscalationOfficerSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField()
    role = serializers.CharField()


class EscalationSiteSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    site_code = serializers.CharField()
    name = serializers.CharField()
    region = serializers.CharField()
    county = serializers.CharField()
    down_since = serializers.DateTimeField(allow_null=True)


class EscalationDataSerializer(serializers.Serializer):
    contractor = serializers.CharField()
    vendor_email = serializers.EmailField(allow_blank=True)
    sites = EscalationSiteSerializer(many=True)
    officers = EscalationOfficerSerializer(many=True)


# ---------------------------------------------------------
# Report Table Serializers (Flat)
# ---------------------------------------------------------
class ReportSiteSerializer(serializers.ModelSerializer):
    county_name = serializers.CharField(source='county.name', read_only=True)
    region_name = serializers.CharField(source='county.region.name', read_only=True)
    network_name = serializers.CharField(source='county.region.network.name', read_only=True)
    contractor_name = serializers.CharField(source='contractor.company_name', read_only=True)
    ip_address = serializers.CharField(source='device_ip_address', allow_blank=True, allow_null=True)
    site_name = serializers.CharField(source='name', read_only=True)
    last_ping = serializers.DateTimeField(source='last_ping_time', allow_null=True, read_only=True)

    class Meta:
        model = Site
        fields = [
            'id', 'site_name', 'networkdevice', 'ip_address', 'current_status', 'last_ping',
            'county_name', 'region_name', 'network_name', 'contractor_name'
        ]


class ContractorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contractor
        fields = ['id', 'company_name', 'primary_contact', 'email', 'phone', 'coverage_regions']


class IctOfficerSerializer(serializers.ModelSerializer):
    assigned_region = serializers.CharField(source='assigned_region.name', read_only=True)

    class Meta:
        model = IctOfficer
        fields = ['id', 'name', 'email', 'phone', 'assigned_region']
