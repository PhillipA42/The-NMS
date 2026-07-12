from django.urls import path
from .views import SidebarTreeView, ReportTableView

urlpatterns = [
    path('sidebar-tree/', SidebarTreeView.as_view(), name='sidebar-tree'),
    path('reports/', ReportTableView.as_view(), name='report-table'),
]
