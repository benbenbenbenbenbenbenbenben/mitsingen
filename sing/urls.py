from django.conf.urls import url

from . import views

urlpatterns = [
    url(r'^$', views.index, name='index'),
    url(r'^(?P<choir_id>[0-9]+)/(?P<song_id>[0-9]+)/(?P<part_id>[0-9]+)/$', views.song, name='song'),
    url(r'^register$', views.register, name='register'),
    url(r'^find_choirs$', views.find_choirs, name='find_choirs'),
    url(r'^join_choir/(?P<choir_id>[0-9]+)$', views.join_choir, name='join_choir'),
    url(r'^approve_join_choir/(?P<user_id>[0-9]+)/(?P<choir_id>[0-9]+)/(?P<approve>[01])$', views.approve_join_choir, name='approve_join_choir'),
    url(r'^approve/(?P<user_id>[0-9]+)/(?P<choir_id>[0-9]+)$', views.approve, name='approve'),
    url(r'^logout$', views.logout, name='logout'),
    url(r'^choir/(?P<choir_id>[0-9]+)$', views.choir, name='choir'),
    url(r'^singer$', views.singer, name='singer'),
    url(r'^keep/(?P<part_id>[0-9]+)/(?P<keep_number>[0-9]+)$', views.keep, name='keep'),
    url(r'^share/(?P<recording_id>[0-9]+)/(?P<choir_id>[0-9]+)$', views.share, name='share'),
]
