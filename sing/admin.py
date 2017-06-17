from django.contrib import admin

from .models import Song, Part, Section, Performance, Choir, Recording, PartPerformance, Singer, TimeSignature

class PartInline(admin.TabularInline):
    model = Part
    extra = 4

class SectionInline(admin.TabularInline):
    model = Section
    extra = 1

class TimeSignatureInline(admin.TabularInline):
    model = TimeSignature
    extra = 1

class SongAdmin(admin.ModelAdmin):
    inlines = [TimeSignatureInline, PartInline, SectionInline]

admin.site.register(Song, SongAdmin)
admin.site.register(Performance)
admin.site.register(Choir)
admin.site.register(Recording)
admin.site.register(PartPerformance)
admin.site.register(Singer)

