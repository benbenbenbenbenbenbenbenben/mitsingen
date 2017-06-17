from __future__ import unicode_literals

from django.db import models
from django.conf import settings
from django.db.models.signals import post_delete
from django.dispatch.dispatcher import receiver
import datetime

class Song(models.Model):
    name = models.CharField(max_length=200)
    notes = models.CharField(max_length=2000)
    recording_file = models.FileField()
    tempo = models.FloatField()

    def __unicode__(self):
        return u"%s" % self.name

class TimeSignature(models.Model):
    song = models.ForeignKey(Song, on_delete=models.CASCADE)
    start_beat_in_song = models.IntegerField()
    start_beat_in_bar = models.IntegerField()
    beats_per_bar = models.IntegerField()

    def __unicode__(self):
        return u"At beat %i start %i beats per bar" % (self.start_beat_in_song, self.beats_per_bar)

class Singer(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    latency = models.FloatField()
    show_help = models.BooleanField()
    meetup_name = models.TextField(blank = True)
    registration_message = models.TextField(blank = True)

class Part(models.Model):
    song = models.ForeignKey(Song, on_delete=models.CASCADE, related_name = 'parts')
    name = models.CharField(max_length=200)
    recording_file = models.FileField()
    midi_file = models.FileField(null=True, blank=True)

    def __unicode__(self):
        return u"%s" % self.name

class Section(models.Model):
    song = models.ForeignKey(Song, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    start = models.IntegerField()
    end = models.IntegerField()
    lyrics = models.TextField(blank = True)

    def __unicode__(self):
        return u"%s" % self.name

class Performance(models.Model):
    song = models.ForeignKey(Song, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    default_part = models.ForeignKey(Part, on_delete=models.CASCADE)

    def __unicode__(self):
        return u"%s performing %s" % (self.user.username, self.song.name)

class Choir(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank = True)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name = 'choirs')
    songs = models.ManyToManyField(Song)
    start_date = models.DateField(auto_now_add=False, default = datetime.date(2013, 1, 1))
    end_date = models.DateField(auto_now_add=False, default = datetime.date(2100, 1, 1))

    @property
    def is_old(self):
        return datetime.date.today() > self.end_date

    def __unicode__(self):
        return u"%s" % self.name

class Recording(models.Model):
    name = models.CharField(max_length=200)
    recording_file = models.FileField()
    created = models.DateTimeField(auto_now_add=True)
    shared_with = models.ManyToManyField(Choir)

    def __unicode__(self):
        return u"%s" % (
            self.created
        )

@receiver(post_delete, sender=Recording)
def recording_delete(sender, instance, **kwargs):
    # Pass false so FileField doesn't save the model.
    instance.recording_file.delete(False)

class PartPerformance(models.Model):
    performance = models.ForeignKey(Performance, on_delete=models.CASCADE)
    part = models.ForeignKey(Part, on_delete=models.CASCADE)

    recording1 = models.OneToOneField(Recording, on_delete=models.SET_NULL, null=True, related_name='recording1_of')
    recording2 = models.OneToOneField(Recording, on_delete=models.SET_NULL, null=True, related_name='recording2_of')
    recording3 = models.OneToOneField(Recording, on_delete=models.SET_NULL, null=True, related_name='recording3_of')

    def __unicode__(self):
        return u"%s %s" % (self.performance, self.part)

