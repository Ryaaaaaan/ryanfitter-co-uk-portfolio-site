#!/usr/bin/env python3
import aws_cdk as cdk
from personal_dashboard_stack import PersonalDashboardStack

app = cdk.App()
PersonalDashboardStack(
    app,
    "RyanFitterPersonalDashboard",
    env=cdk.Environment(region="eu-west-2"),
)
app.synth()
