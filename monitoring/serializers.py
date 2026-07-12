from rest_framework import serializers
from .models import Network, Region, County, SubCounty, Site

# ---------------------------------------------------------
# Sidebar Tree Serializers (Nested)
# ---------------------------------------------------------
class SidebarSiteSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source='site_code', read_only=True)
    
    class Meta:
        model = Site
        fields = ['id', 'label', 'site_code', 'name', 'current_status']

class SidebarSubCountySerializer(serializers.ModelSerializer):
    sites = SidebarSiteSerializer(many=True, read_only=True)
    
    class Meta:
        model = SubCounty
        fields = ['id', 'name', 'sites']

class SidebarCountySerializer(serializers.ModelSerializer):
    sub_counties = SidebarSubCountySerializer(many=True, read_only=True)
    
    class Meta:
        model = County
        fields = ['id', 'name', 'sub_counties']

class SidebarRegionSerializer(serializers.ModelSerializer):
    counties = SidebarCountySerializer(many=True, read_only=True)
    
    class Meta:
        model = Region
        fields = ['id', 'name', 'counties']

class SidebarNetworkSerializer(serializers.ModelSerializer):
    regions = SidebarRegionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Network
        fields = ['id', 'name', 'regions']


# ---------------------------------------------------------
# Report Table Serializers (Flat)
# ---------------------------------------------------------
class ReportSiteSerializer(serializers.ModelSerializer):
    sub_county_name = serializers.CharField(source='sub_county.name', read_only=True)
    county_name = serializers.CharField(source='sub_county.county.name', read_only=True)
    region_name = serializers.CharField(source='sub_county.county.region.name', read_only=True)
    network_name = serializers.CharField(source='sub_county.county.region.network.name', read_only=True)

    class Meta:
        model = Site
        fields = [
            'id', 'name', 'site_code', 'ip_address', 'current_status', 'last_ping_time',
            'sub_county_name', 'county_name', 'region_name', 'network_name'
        ]
