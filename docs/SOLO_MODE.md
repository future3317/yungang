# Solo Mode

Solo mode is a formal shared-screen mode. Choosing one player creates the scenario-defined number of controllable characters, normally two. `shared.solo_mode` and `shared.controlled_character_ids` make this explicit to the client. The same player takes each character's turn; hands remain open information and no remote human player is implied.

Scenario solo rules can grant extra AP, planning marks, route discounts, or rounds. Their final values are exposed through `shared.effective_rules`.
