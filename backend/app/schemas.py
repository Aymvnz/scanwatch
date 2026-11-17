from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

SimulationId = Literal["imaging_equipment", "patient_population", "hospital_workflow", "prediction_distribution", "performance_degradation"]


class ExperimentRequest(BaseModel):
    model_id: str
    baseline_dataset_id: str = "baseline"
    current_dataset_id: str = "current"
    simulation: SimulationId
    intensity: float = Field(0.6, gt=0, le=1, description="Strength of the simulated change (0 to 1).")
    seed: int = Field(42, ge=0, le=2**31 - 1)


class AlertPatch(BaseModel):
    status: Optional[Literal["open", "investigating", "resolved"]] = None
    note: Optional[str] = Field(None, max_length=2000)
    author: str = Field("Demo User", max_length=80)

    @model_validator(mode="after")
    def need_something(self):
        if self.status is None and not (self.note and self.note.strip()):
            raise ValueError("Provide a status change or a non-empty note.")
        return self


class ReportRequest(BaseModel):
    model_id: str
    days: Optional[Literal[30, 60, 90]] = None
    baseline_dataset_id: str = "baseline"
    current_dataset_id: str = "current"
    experiment_id: Optional[str] = None
    site: Optional[str] = None


class Health(BaseModel):
    status: str
    version: str
    data: str
    persistence: str
