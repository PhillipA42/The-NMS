from django.urls import path
from .views import (
    ClearImportedDataView,
    ContractorListView,
    CsvImportView,
    DashboardSummaryView,
    EscalationDataView,
    IctOfficerListView,
    PollSitesView,
    RecentDownView,
    RegionStatusView,
    ReportTableView,
    SidebarTreeView,
)

urlpatterns = [
    path('sidebar-tree/', SidebarTreeView.as_view(), name='sidebar-tree'),
    path('dashboard-summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('region-status/', RegionStatusView.as_view(), name='region-status'),
    path('recent-down/', RecentDownView.as_view(), name='recent-down'),
    path('escalation-data/', EscalationDataView.as_view(), name='escalation-data'),
    path('reports/', ReportTableView.as_view(), name='report-table'),
    path('csv-import/', CsvImportView.as_view(), name='csv-import'),
    path('clear-imported-data/', ClearImportedDataView.as_view(), name='clear-imported-data'),
    path('poll-sites/', PollSitesView.as_view(), name='poll-sites'),
    path('contractors/', ContractorListView.as_view(), name='contractors'),
    path('ict-officers/', IctOfficerListView.as_view(), name='ict-officers'),
]
