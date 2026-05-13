from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models here so Alembic can detect them
from app.models.user import User  # noqa: F401, E402
from app.models.profile import CoachProfile, ClientProfile  # noqa: F401, E402
from app.models.subscription import Subscription  # noqa: F401, E402
from app.models.workout import WorkoutAssignment, Exercise  # noqa: F401, E402
from app.models.supplement import SupplementPlan, SupplementItem, SupplementLog  # noqa: F401, E402
from app.models.progress import ProgressEntry  # noqa: F401, E402
from app.models.message import Message  # noqa: F401, E402
from app.models.weekly_goal import WeeklyGoal  # noqa: F401, E402
from app.models.streak import Streak  # noqa: F401, E402
from app.models.attendance import Attendance  # noqa: F401, E402
from app.models.place import Place  # noqa: F401, E402
from app.models.notification import NotificationSetting  # noqa: F401, E402
from app.models.client_invite import ClientInvite  # noqa: F401, E402
from app.models.review import CoachReview, ClientAssessment  # noqa: F401, E402
from app.models.exercise_result import ExerciseResult  # noqa: F401, E402