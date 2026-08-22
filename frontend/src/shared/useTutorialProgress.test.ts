import { describe, expect, it } from 'vitest';
import { tutorialContextForAction } from './useTutorialProgress';

describe('tutorialContextForAction', () => {
  it('maps player actions to the five contextual lessons', () => {
    expect(tutorialContextForAction('move')).toBe('move');
    expect(tutorialContextForAction('explore')).toBe('explore');
    expect(tutorialContextForAction('interpret_evidence')).toBe('interpret_evidence');
    expect(tutorialContextForAction('resolve_event')).toBe('resolve_event');
    expect(tutorialContextForAction('use_action_card')).toBe('use_action_card');
    expect(tutorialContextForAction('play_card')).toBe('use_action_card');
  });

  it('does not open the manual for follow-up steps that are already covered by the lesson', () => {
    expect(tutorialContextForAction('form_interpretation')).toBeNull();
    expect(tutorialContextForAction('choose_intervention')).toBeNull();
    expect(tutorialContextForAction('end_turn')).toBeNull();
  });
});
