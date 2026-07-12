from rest_framework import generics
from .models import Network, Site
from .serializers import SidebarNetworkSerializer, ReportSiteSerializer

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
