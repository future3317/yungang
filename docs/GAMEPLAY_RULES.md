# Gameplay Rules

The backend is the single authority for action legality, costs, targets, scenario rules, and outcomes.

## Effective rules

Rules are merged as: baseline rules, scenario rules, difficulty modifiers, then solo modifiers. The resulting `shared.effective_rules` is returned with every game state. Difficulty changes available rounds, restoration resources, opening damage, event preview count, and solo AP where configured.

## Evidence and tasks

A task follows one explicit research loop: the player places eligible evidence into `support`, `conflict`, or `pending`; when the required evidence, domains, origins and combination tags are satisfied, the player forms an interpretation; finally, the player chooses `act_now`, `minimal`, or `record`. The intervention completes the task and applies its distinct changes to influence, damage, threat, research clues, projects and the final archive. There is no separate direct-contribution action path.

Evidence placement is not a claim that the represented history is proven. It is the players' current interpretation of the available sources, and conflict/pending placements are intentionally valid states rather than automatic failures.

## Routes, events, and pressure

Blocked routes prohibit movement until repaired. Surveying turns an unknown blocked route into a strained route; repairing restores travel; connecting an already restored route contributes to regional connection. Event preparation and role abilities reduce pressure when their stated conditions are met. Weathering pressure reaching the scenario limit causes defeat.

## End state

A scenario victory requires its core project and all enabled objectives, or its configured domain path where no core project exists. Defeat is caused by closed-site limits, weathering pressure, or exhausted rounds. Results include a dimensional score and grade.
