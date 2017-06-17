Set the following environment variables:

- DJANGO_SECRET_KEY - some random string that Django uses for encryption
- DJANGO_DEBUG - True if you want to see nice debugging output on a response page when there a problem
- DJANGO_EMAIL_HOST - host name for a mail server for sending emails for registration, confirmation and so on
- DJANGO_EMAIL_HOST_USER - username for above host
- DJANGO_EMAIL_HOST_PASSWORD - password for above user/host

Then:

```
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

And point your browser at http://localhost:8000/admin to start creating a song and a choir and so on, and http://localhost:8000/sing to use the user-facing end of the site.
