from django.shortcuts import render
from django.template.loader import render_to_string
from django.http import HttpResponse
from django.template import loader
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.contrib.auth import logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect
from django.core.files.base import ContentFile
from django.core.mail import send_mail

from .models import Song, Part, Recording, Performance, PartPerformance, Choir, Singer, Section, TimeSignature
from .forms import LoginForm, SingerForm, CreateSectionForm, CreateTimeSignatureForm, RegisterForm

def first_name_or_username(user):
    if user.first_name is not None and user.first_name != "":
        return user.first_name
    return user.username

def get_or_create_singer(user):
    try:
        singer = user.singer
    except AttributeError:
        singer = Singer(
            latency=0.1,
            show_help = True,
            user=user)

        singer.save()
        user.save()

    return singer

def register(request):
    if request.user.is_authenticated():
        return index(request)

    # if this is a POST request we need to process the form data
    if request.method == 'POST':
        # create a form instance and populate it with data from the request:
        form = RegisterForm(request.POST)

        # check whether it's valid:
        if form.is_valid():
            new_user = User(
                first_name = form.cleaned_data["first_name"],
                last_name = form.cleaned_data["last_name"],
                username = form.cleaned_data["username"],
                email = form.cleaned_data["email"],
                is_active = False
            )
            new_user.set_password(form.cleaned_data["password"])
            new_user.save()

            new_singer = Singer(
                latency=0.1,
                show_help = True,
                meetup_name = form.cleaned_data["meetup_name"],
                registration_message = form.cleaned_data["message"],
                user=new_user
            )
            new_singer.save()

            email_body = render_to_string(
                'sing/approve_email.html',
                {
                    'user': new_user,
                    'singer': new_singer,
                    'url_prefix': request.scheme+"://"+request.get_host(),
                    'choirs': Choir.objects.order_by('-name')
                }
            )

            send_mail(
                'New mitsingen user: %s %s' % (new_user.first_name, new_user.last_name),
                email_body,
                'Mitsingen <ben@ooooooooo.net>',
                ['ben@ooooooooo.net'],
                fail_silently=True,
            )

            return render(request, 'sing/registration_confirmation.html')
        else:
            # Show errors in form
            return render(request, 'sing/register.html', { 'form': form })

    else:
        form = RegisterForm()
        return render(request, 'sing/register.html', { 'form': form })

@login_required
def approve(request, user_id, choir_id):
    if request.user.is_staff:
        user = User.objects.get(pk=user_id)
        choir = Choir.objects.get(pk=choir_id)

        user.is_active = True
        user.save()

        choir.members.add(user)
        choir.save()

        email_body = render_to_string(
            'sing/approved_email.html',
            {
                'user': user,
                'choir': choir
            }
        )

        send_mail(
            'Your mitsingen registration has been approved',
            email_body,
            'Mitsingen admin <mitsingen.antis@ooooooooo.net>',
            ['%s %s <%s>' % (user.first_name, user.last_name, user.email)],
            fail_silently=True,
        )

        return HttpResponse("User %s (%s %s %s) activated." % (user.username, user.first_name, user.last_name, user.email))

    else:
        return HttpResponse(status=404)

def index(request):
    # if this is a POST request we need to process the form data
    if request.method == 'POST':
        # create a form instance and populate it with data from the request:
        form = LoginForm(request.POST)
        # check whether it's valid:
        if form.is_valid():
            user = authenticate(
                username=form.cleaned_data["username"],
                password=form.cleaned_data["password"])
            if user is not None:
                if user.is_active:
                    login(request, user)

    if not request.user.is_authenticated():
        form = LoginForm()
        return render(request, 'sing/login.html', { 'form': form })

    choirs = request.user.choirs.order_by('-name')
    index_template = loader.get_template('sing/index.html')

    index_html = index_template.render({
            'choirs': choirs,
            'first_name': first_name_or_username(request.user),
        },
        request
    )

    return HttpResponse(index_html)

@login_required
def find_choirs(request):
    choirs = Choir.objects.exclude(members=request.user).order_by('-name')
    find_choirs_template = loader.get_template('sing/find_choirs.html')

    find_choirs_html = find_choirs_template.render({
            'choirs': choirs,
            'first_name': first_name_or_username(request.user),
        },
        request
    )

    return HttpResponse(find_choirs_html)

@login_required
def join_choir(request, choir_id):
    choir = Choir.objects.get(pk=choir_id)
    singer = get_or_create_singer(request.user)

    email_body = render_to_string(
        'sing/approve_join_choir_email.html',
        {
            'user': request.user,
            'singer': singer,
            'url_prefix': request.scheme+"://"+request.get_host(),
            'choir': choir
        }
    )

    send_mail(
        '%s %s wants to join %s' % (request.user.first_name, request.user.last_name, choir.name),
        email_body,
        'Mitsingen <ben@ooooooooo.net>',
        ['ben@ooooooooo.net'],
        fail_silently=True,
    )

    template = loader.get_template('sing/join_choir.html')

    html = template.render({
            'choir': choir,
            'first_name': first_name_or_username(request.user),
        },
        request
    )

    return HttpResponse(html)

@login_required
def approve_join_choir(request, user_id, choir_id, approve):
    if request.user.is_staff:
        user = User.objects.get(pk=user_id)
        choir = Choir.objects.get(pk=choir_id)
        approve = approve == '1'

        if approve:
            choir.members.add(user)
            choir.save()

        email_body = render_to_string(
            'sing/approved_join_choir_email.html',
            {
                'user': user,
                'choir': choir,
                'approved': approve
            }
        )

        send_mail(
            'Your request to join %s has been %s' % (choir.name, "approved" if approve else "denied"),
            email_body,
            'Mitsingen admin <mitsingen.antis@ooooooooo.net>',
            ['%s %s <%s>' % (user.first_name, user.last_name, user.email)],
            fail_silently=True,
        )

        return HttpResponse("User %s (%s %s %s) %s." % (user.username, user.first_name, user.last_name, user.email, "added" if approve else "denied"))

    else:
        return HttpResponse(status=404)

@login_required
def singer(request):
    singer = get_or_create_singer(request.user)
    settings_updated = False

    # if this is a POST request we need to process the form data
    if request.method == 'POST':
        # create a form instance and populate it with data from the request:
        form = SingerForm(request.POST)
        # check whether it's valid:
        if form.is_valid():
            singer.latency = form.cleaned_data["latency"]
            singer.show_help = form.cleaned_data["showHelp"]

            if form.cleaned_data["password"] != "":
                request.user.set_password(form.cleaned_data["password"])

            singer.save()
            request.user.save()

            settings_updated = True
    else:
        form = SingerForm(initial={
            'latency': str(singer.latency),
            "showHelp": singer.show_help
        })

    singer_template = loader.get_template('sing/singer.html')

    singer_html = singer_template.render({
            'settings_updated': settings_updated,
            'first_name': first_name_or_username(request.user),
            'form': form,
            'settings_updated': settings_updated
        },
        request
    )

    return HttpResponse(singer_html)

@login_required
def choir(request, choir_id):
    choir = Choir.objects.get(pk=choir_id)

    if not choir.members.filter(id=request.user.id).exists():
        return HttpResponse(status=404)

    songs = choir.songs.order_by('-name')
    choir_template = loader.get_template('sing/choir.html')
    song_overview_template = loader.get_template('sing/song_overview.html')

    def get_default_part(song):
        performance = Performance.objects.filter(song=song, user=request.user)
        return performance[0].default_part if len(performance) > 0 else None

    songs_overview_html = "\n".join([
        song_overview_template.render({
                'choir': choir,
                'song': song,
                'default_part': get_default_part(song),
                'parts': song.parts.order_by('name'),
            },
            request)
        for song in songs
    ])

    choir_html = choir_template.render({
            'choir': choir,
            'first_name': first_name_or_username(request.user),
            'songs_overview_html': songs_overview_html,
        },
        request
    )

    return HttpResponse(choir_html)

@login_required
def song(request, choir_id, song_id, part_id):
    choir = Choir.objects.get(pk=choir_id)

    if not choir.members.filter(id=request.user.id).exists():
        return HttpResponse(status=404)
        
    singer = get_or_create_singer(request.user)
    song_template = loader.get_template('sing/song.html')
    song = Song.objects.get(pk=song_id)
    part = song.parts.get(pk=part_id)

    if request.method == 'POST':
        createSectionForm = CreateSectionForm(request.POST)
        createTimeSignatureForm = CreateTimeSignatureForm(request.POST)

        if createSectionForm.is_valid():
            section = Section(
                song = song,
                name = createSectionForm.cleaned_data["name"],
                start = int(createSectionForm.cleaned_data["start"]),
                end = int(createSectionForm.cleaned_data["end"]),
                lyrics = createSectionForm.cleaned_data["lyrics"]
            )

            section.save()
            song.save()

        elif createTimeSignatureForm.is_valid():
            timeSignature = TimeSignature(
                song = song,
                start_beat_in_song = int(createTimeSignatureForm.cleaned_data["startBeatInSong"]),
                start_beat_in_bar = int(createTimeSignatureForm.cleaned_data["startBeatInBar"]),
                beats_per_bar = int(createTimeSignatureForm.cleaned_data["beatsPerBar"]),
            )

            timeSignature.save()
            song.save()

    createSectionForm = CreateSectionForm(initial={
        'name': "",
        'initialCountIn': "0",
        'countIn': "0"
    })

    createTimeSignatureForm = CreateTimeSignatureForm(initial={
        'startBeatInBar': "0",
        'beatsPerBar': "4"
    })

    performance = get_or_create_performance(
        song=song,
        user=request.user,
        default_part=part)

    partPerformance = get_or_create_part_performance(
        part=part,
        performance=performance)

    performance.default_part = part
    performance.save()

    song_html = song_template.render({
            'show_help': singer.show_help,
            'first_name': first_name_or_username(request.user),
            'singer': get_or_create_singer(request.user),
            'song': song,
            'part': part,
            'other_parts': [ other_part for other_part in song.parts.order_by('name') if other_part != part ],
            'choir': choir,
            'part_performance': partPerformance,
            'sections': song.section_set.order_by('name'),
            'is_staff': request.user.is_staff,
            'time_signatures': song.timesignature_set.order_by('start_beat_in_song'),
            'createSectionForm': createSectionForm,
            'createTimeSignatureForm': createTimeSignatureForm,
            'isFreeform': song.tempo == 1000
        },
        request
    )

    return HttpResponse(song_html)

@login_required
def logout(request):
    auth_logout(request)
    return HttpResponseRedirect("/sing")

def get_or_create_performance(song, user, default_part):
    performance = Performance.objects.filter(song=song, user=user)

    if len(performance) > 0:
        return performance[0]

    performance = Performance(
        song=song,
        user=user,
        default_part=default_part)

    performance.save()

    return performance

def get_or_create_part_performance(performance, part):
    partPerformance = PartPerformance.objects.filter(performance=performance, part=part)

    if len(partPerformance) > 0:
        return partPerformance[0]

    partPerformance = PartPerformance(
        performance=performance,
        part=part)

    partPerformance.save()

    return partPerformance

@login_required
def keep(request, part_id, keep_number):
    keep_number = int(keep_number)
    html = ""

    part = Part.objects.get(pk=part_id)

    performance = get_or_create_performance(
        song=part.song,
        user=request.user,
        default_part=part)

    partPerformance = get_or_create_part_performance(
        part=part,
        performance=performance)

    recording = Recording(
        name="",
        recording_file=request.FILES["recording"])

    recording.save()

    if keep_number == 1:
        if partPerformance.recording1 is not None:
            partPerformance.recording1.delete()
        partPerformance.recording1 = recording
    elif keep_number == 2:
        if partPerformance.recording2 is not None:
            partPerformance.recording2.delete()
        partPerformance.recording2 = recording
    elif keep_number == 3:
        html += "Setting recording 3"
        if partPerformance.recording3 is not None:
            partPerformance.recording3.delete()
        partPerformance.recording3 = recording

    partPerformance.save()

    return HttpResponse(str(html))

@login_required
def share(request, recording_id, choir_id):
    recording = Recording.objects.get(pk=recording_id)
    choir = Choir.objects.get(pk=choir_id)

    recording.shared_with.add(choir);

    return HttpResponse()

