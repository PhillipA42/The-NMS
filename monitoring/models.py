from django.db import models
from django.utils import timezone

class SyncLog(models.Model):
    """Model to track the last time contacts were synced."""
    contacts_last_synced_at = models.DateTimeField(null=True, blank=True)

class Contractor(models.Model):
    company_name = models.CharField(max_length=255)
    primary_contact = models.CharField(max_length=255)
    # Match by email for upsert, so it must be unique
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=50, blank=True)
    coverage_regions = models.TextField(blank=True, help_text="Comma-separated or JSON list of regions")

    def __str__(self):
        return f"{self.company_name} ({self.primary_contact})"

class IctOfficer(models.Model):
    name = models.CharField(max_length=255)
    # Match by email for upsert, so it must be unique
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=50, blank=True)
    assigned_region = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.name

class Network(models.Model):
    """Top level OGN network container."""
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class Region(models.Model):
    network = models.ForeignKey(Network, on_delete=models.CASCADE, related_name='regions', null=True, blank=True)
    name = models.CharField(max_length=255, unique=True)
    
    def __str__(self):
        return self.name

class County(models.Model):
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='counties')
    name = models.CharField(max_length=255)

    class Meta:
        unique_together = ('region', 'name')

    def __str__(self):
        return f"{self.name}, {self.region.name}"

class SubCounty(models.Model):
    county = models.ForeignKey(County, on_delete=models.CASCADE, related_name='sub_counties')
    name = models.CharField(max_length=255)

    class Meta:
        unique_together = ('county', 'name')

    def __str__(self):
        return f"{self.name}, {self.county.name}"

class Site(models.Model):
    name = models.CharField(max_length=100)
    site_code = models.CharField(max_length=50, unique=True)
    ip_address = models.GenericIPAddressField(protocol='both')
    current_status = models.BooleanField(default=True)
    last_ping_time = models.DateTimeField(null=True, blank=True)
    sub_county = models.ForeignKey(SubCounty, on_delete=models.CASCADE, related_name='sites')

    class Meta:
        unique_together = ('sub_county', 'name')

    def __str__(self):
        return self.site_code

class PingHistory(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='ping_history')
    status = models.BooleanField()
    logged_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.site.name} - {'Up' if self.status else 'Down'} at {self.logged_at}"
