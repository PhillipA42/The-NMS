from django.urls import path
from .views import (
    DashboardSummaryView,
    EscalationDataView,
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
]
