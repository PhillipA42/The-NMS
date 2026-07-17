#!/usr/bin/env python
"""
Populate the database with sample data for development/testing.
Run with: python manage.py shell < populate_db.py
Or: python populate_db.py (with proper Django setup)
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nms_project.settings')
django.setup()

from monitoring.models import Network, Region, Site, Contractor, IctOfficer, County
from monitoring.services import poll_sites_concurrently

# Clear existing data (optional - comment out if you want to append)
# Network.objects.all().delete()
# Contractor.objects.all().delete()
# IctOfficer.objects.all().delete()

# Create Networks
print("Creating networks...")
network1, _ = Network.objects.get_or_create(name="OGN")
network2, _ = Network.objects.get_or_create(name="MPLS")

# Create Regions
print("Creating regions...")
region1, _ = Region.objects.get_or_create(name="Nairobi", network=network1)
region2, _ = Region.objects.get_or_create(name="Central", network=network1)
region3, _ = Region.objects.get_or_create(name="Western", network=network2)
region4, _ = Region.objects.get_or_create(name="Eastern", network=network2)

# Create Counties
print("Creating counties...")
county1, _ = County.objects.get_or_create(name="Nairobi County", region=region1)
county2, _ = County.objects.get_or_create(name="Kiambu County", region=region2)
county3, _ = County.objects.get_or_create(name="Kisumu County", region=region3)

# Create Contractors
print("Creating contractors...")
contractor1, _ = Contractor.objects.get_or_create(
    email="liquid@example.com",
    defaults={"company_name": "Liquid Intelligent Technologies", "primary_contact": "John Smith", "phone": "+254701234567"}
)
contractor2, _ = Contractor.objects.get_or_create(
    email="safaricom@example.com",
    defaults={"company_name": "Safaricom", "primary_contact": "Jane Doe", "phone": "+254702234567"}
)
contractor3, _ = Contractor.objects.get_or_create(
    email="equity@example.com",
    defaults={"company_name": "Equity Bank", "primary_contact": "Peter Johnson", "phone": "+254703234567"}
)

# Create Sites
print("Creating sites...")
Site.objects.get_or_create(
    site_code="SITE001",
    defaults={"name": "Nairobi HQ", "county": county1, "contractor": contractor1, "current_status": True}
)
Site.objects.get_or_create(
    site_code="SITE002",
    defaults={"name": "Kiambu Branch", "county": county2, "contractor": contractor2, "current_status": True}
)
Site.objects.get_or_create(
    site_code="SITE003",
    defaults={"name": "Kisumu Office", "county": county3, "contractor": contractor3, "current_status": False}
)
Site.objects.get_or_create(
    site_code="SITE004",
    defaults={"name": "Secondary Site A", "county": county1, "contractor": contractor1, "current_status": True}
)
Site.objects.get_or_create(
    site_code="SITE005",
    defaults={"name": "Secondary Site B", "county": county2, "contractor": contractor2, "current_status": True}
)

# Create ICT Officers
print("Creating ICT officers...")
IctOfficer.objects.get_or_create(
    email="john.doe@example.com",
    defaults={"name": "John Doe", "assigned_region": region1, "phone": "+254701111111"}
)
IctOfficer.objects.get_or_create(
    email="jane.smith@example.com",
    defaults={"name": "Jane Smith", "assigned_region": region2, "phone": "+254702222222"}
)
IctOfficer.objects.get_or_create(
    email="peter.johnson@example.com",
    defaults={"name": "Peter Johnson", "assigned_region": region3, "phone": "+254703333333"}
)

print("✅ Database populated with sample data!")
print(f"Networks: {Network.objects.count()}")
print(f"Regions: {Region.objects.count()}")
print(f"Counties: {County.objects.count()}")
print(f"Sites: {Site.objects.count()}")
print(f"Contractors: {Contractor.objects.count()}")
print(f"ICT Officers: {IctOfficer.objects.count()}")

print('Triggering initial live ping poll...')
polled = poll_sites_concurrently()
print(f'Ping polling completed for {polled} site(s).')
