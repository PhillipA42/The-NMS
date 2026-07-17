#!/usr/bin/env python
import os
import django
import json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nms_project.settings')
django.setup()

from monitoring.models import Network, Region, County

ogn_network = Network.objects.filter(name='OGN').prefetch_related('regions__counties').first()

if ogn_network:
    print(f"OGN has {ogn_network.regions.count()} regions")
    
    regions_payload = []
    for region in ogn_network.regions.all()[:1]:  # Just check first region
        print(f"\nRegion: {region.name}")
        print(f"Region's network: {region.network.name if region.network else 'None'}")
        
        counties_payload = []
        for county in region.counties.all()[:1]:  # Just check first county
            print(f"  County: {county.name}")
            
            networks_payload = []
            if region.network:
                networks_payload.append({
                    'id': region.network.id,
                    'name': region.network.name,
                    'sites': [],
                })
                print(f"    Networks in county: {len(networks_payload)}")
                print(f"    Network: {networks_payload[0]['name']}")
