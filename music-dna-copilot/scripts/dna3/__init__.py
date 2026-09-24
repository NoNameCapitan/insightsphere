"""Music DNA Copilot 3.0 product layer.

A thin, stdlib-only service layer that turns the 2.x engines (sources,
identity graph, Music DNA brain, candidate retrieval, ranking, capsules,
Track Resolver, Quality Lab, beta instrumentation) into one product loop:

    connect -> unified Music DNA -> intent -> capsule -> listen -> react
    -> DNA learns -> better next capsule

Nothing here fabricates data: every number shown in the UI is derived from
files in the local `outputs/` folder, and missing data is reported as
missing.
"""

VERSION = "3.0.0"
