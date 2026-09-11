import { createContext, useContext } from 'react';

// the shell's `evict` command reaches the flow section through this
export const FlowContext = createContext({ current: () => 'unavailable' });
export const useEvict = () => useContext(FlowContext);
