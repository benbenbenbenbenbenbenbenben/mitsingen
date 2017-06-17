from django import forms
from django.core.validators import RegexValidator, EmailValidator
from django.contrib.auth.models import User

class LoginForm(forms.Form):
    username = forms.CharField(label='User name', max_length=100)
    password = forms.CharField(label='Password', max_length=100, widget=forms.PasswordInput())

class RegisterForm(forms.Form):
    alphanumeric = RegexValidator(r'^[0-9a-zA-Z]*$', 'Only letters and numbers are allowed.')

    username = forms.CharField(label='User name', max_length=100, validators=[alphanumeric])
    password = forms.CharField(label='Password', max_length=100, widget=forms.PasswordInput())
    first_name = forms.CharField(label='First name', max_length=100)
    last_name = forms.CharField(label='Last name', max_length=100)
    meetup_name = forms.CharField(label='meetup.com name (if you have one)', max_length=100, required=False)
    email = forms.CharField(label='Email', max_length=100, widget=forms.EmailInput(), validators = [EmailValidator()])
    message = forms.CharField(label='Which singing group do you want to join? Please also give any other information that\'ll help verify your registration', widget=forms.Textarea())

    def clean_username(self):
        username = self.cleaned_data['username']

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return username
        raise forms.ValidationError(u'User name "%s" is already in use.' % username)


class SingerForm(forms.Form):
    password = forms.CharField(label='Password', required=False, max_length=100, widget=forms.PasswordInput())
    latency = forms.FloatField(label='Latency', widget=forms.NumberInput(attrs={'step': '0.05'}))
    showHelp = forms.BooleanField(label='Show instructions', required=False)

class CreateSectionForm(forms.Form):
    name = forms.CharField(label='Section name', required=True, max_length=100)
    start = forms.IntegerField(label='Start')#, widget=forms.HiddenInput())
    end = forms.IntegerField(label='End')#, widget=forms.HiddenInput())
    initialCountIn = forms.IntegerField(label='Initial count-in', widget=forms.NumberInput(attrs={'step': '1'}))
    countIn = forms.IntegerField(label='Count-in', widget=forms.NumberInput(attrs={'step': '1'}))
    lyrics = forms.CharField(label='Lyrics', widget=forms.Textarea())

class CreateTimeSignatureForm(forms.Form):
    startBeatInSong = forms.IntegerField(label='Start beat in song')
    startBeatInBar = forms.IntegerField(label='Start beat in bar', widget=forms.NumberInput(attrs={'step': '1'}))
    beatsPerBar = forms.IntegerField(label='Beats per bar', widget=forms.NumberInput(attrs={'step': '1'}))

