from django.apps import AppConfig


class AdmissionsConfig(AppConfig):
    name = 'admissions'

    def ready(self):
        from . import signals  # noqa: F401
