import { describe, it, expect } from 'vitest';
import { OPEN_INVITATION_EVENT } from '../events';

describe('OPEN_INVITATION_EVENT', () => {
  it('is the single namespaced event name shared by every island', () => {
    expect(OPEN_INVITATION_EVENT).toBe('anasofia15:open-invitation');
  });
});
