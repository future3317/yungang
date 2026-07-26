# Gameplay Rules

The backend is the single authority for action legality, costs, targets, scenario rules, and outcomes.

## Effective rules

Rules are merged as: baseline rules, scenario rules, difficulty modifiers, then solo modifiers. The resulting `shared.effective_rules` is returned with every game state. Difficulty changes available rounds, restoration resources, opening damage, event preview count, and solo AP where configured.

## Evidence and tasks

A task completes only after its required card count, domains, origin diversity, combination tags, preferred origins, and minimum contributor count are satisfied. Completed evidence enters the archive and contributes to diversity objectives.

## Routes, events, and pressure

Blocked routes prohibit movement until repaired. Surveying turns an unknown blocked route into a strained route; repairing restores travel; connecting an already restored route contributes to regional connection. Event preparation and role abilities reduce pressure when their stated conditions are met. Weathering pressure reaching the scenario limit causes defeat.

## End state

A scenario victory requires its core project and all enabled objectives, or its configured domain path where no core project exists. Defeat is caused by closed-site limits, weathering pressure, or exhausted rounds. Results include a dimensional score and grade.
