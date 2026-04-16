# 🏠 HomeScreen Continuous Remount/Re-render - Comprehensive Fix Plan

## Executive Summary
The HomeScreen is experiencing continuous "mounting" logs due to a combination of:
1. **Misleading logging** (log runs on every render, not just mount)
2. **Context-induced re-renders** from multiple contexts
3. **Missing React Freeze optimization** for background tabs
4. **AppState listener** triggering unnecessary data reloads

This is NOT actual remounting - React Navigation keeps tab screens mounted by design. The logs are misleading.

---

## Phase 1: IMMEDIATE FIXES (30 minutes)

### 1.1 Enable React Freeze (Critical - Prevents Background Re-renders)
**File:** `App.tsx` or entry point
**Action:** Add at the very top, before any imports that use navigation

```typescript
import { enableFreeze } from 'react-native-screens';

// Enable freeze before any navigation code runs
enableFreeze(true);

// Rest of your imports...
import { NavigationContainer } from '@react-navigation/native';
```

**Why this works:**
- `react-freeze` suspends updates to background screens
- Prevents ALL re-renders when tab is not focused
- Industry standard solution used by major apps

---

### 1.2 Fix Misleading Log Message
**File:** `src/screens/HomeScreen.tsx`
**Current (line 117):**
```typescript
const HomeScreen = () => {
  console.log('🏠 HomeScreen component mounting...');  // ❌ Runs on EVERY render
```

**Replace with:**
```typescript
const HomeScreen = () => {
  useEffect(() => {
    console.log('🏠 HomeScreen ACTUAL MOUNT');
    return () => console.log('🏠 HomeScreen UNMOUNT');
  }, []);
```

**Expected result:** Log will now only appear once on actual mount, not on every re-render.

---

### 1.3 Add freezeOnBlur to Bottom Tab Navigator
**File:** Navigation configuration (likely `App.tsx` or navigation file)

```typescript
<BottomTab.Navigator
  screenOptions={{
    freezeOnBlur: true,  // ✅ Prevent inactive screens from re-rendering
    lazy: true,          // ✅ Only render screen when first focused
    detachInactiveScreens: true,  // ✅ Detach background screens from view hierarchy
  }}
>
  <BottomTab.Screen name="Home" component={HomeScreen} />
  {/* other tabs */}
</BottomTab.Navigator>
```

---

## Phase 2: CONTEXT OPTIMIZATION (1 hour)

### 2.1 Memoize useFilters Context Provider
**File:** `src/contexts/FilterContext.tsx` (or wherever FilterContext is defined)

**Current issue:** If the context provider doesn't use `useMemo`, every render creates a new object, triggering all consumers.

**Fix:**
```typescript
export const FilterProvider = ({ children }) => {
  const [filters, setFilters] = useState({...});
  const [productFilters, setProductFilters] = useState({...});
  const [serviceFilters, setServiceFilters] = useState({...});

  // ✅ Memoize the context value
  const value = useMemo(() => ({
    filters,
    setFilters,
    productFilters,
    setProductFilters,
    serviceFilters,
    setServiceFilters,
    resetProductFilters: () => setProductFilters(defaultProductFilters),
    resetServiceFilters: () => setServiceFilters(defaultServiceFilters),
  }), [filters, productFilters, serviceFilters]);  // Only recreate when these change

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};
```

---

### 2.2 Optimize useAuth Context
**File:** `src/contexts/AuthContext.tsx`

**Issue:** If `user` object is recreated on every auth check, it triggers re-renders.

**Fix:**
```typescript
const value = useMemo(() => ({
  user,
  isAuthenticated: !!user,
  login,
  logout,
}), [user]);  // Only update when user actually changes
```

---

### 2.3 Optimize useCart Context
**File:** `src/contexts/CartContext.tsx`

**Same pattern:** Memoize the context value to prevent unnecessary re-renders.

---

## Phase 3: APSTATE & DATA LOADING FIXES (45 minutes)

### 3.1 Debounce AppState Listener
**File:** `src/screens/HomeScreen.tsx`
**Lines:** 384-403

**Current issue:** AppState listener calls `loadData()` immediately when app returns to foreground.

**Fix:** Add debounce and check if data is already fresh

```typescript
useEffect(() => {
  let lastActiveTime = Date.now();
  
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      const timeSinceLastActive = Date.now() - lastActiveTime;
      
      // ✅ Only reload if app was backgrounded for > 30 seconds
      if (timeSinceLastActive > 30000 && isScreenFocused) {
        if (products.length === 0 && videoFeedData.length === 0) {
          loadData(false);
        }
      }
      
      lastActiveTime = Date.now();
    }
  });

  return () => subscription.remove();
}, [isScreenFocused, products.length, videoFeedData.length]);  // Add proper deps
```

---

### 3.2 Consolidate useFocusEffect Hooks
**File:** `src/screens/HomeScreen.tsx`
**Lines:** 373-381 and 519-535

**Current:** Two separate `useFocusEffect` hooks
**Issue:** Multiple focus handlers can cause race conditions

**Fix:** Combine into single hook:

```typescript
useFocusEffect(
  useCallback(() => {
    setIsScreenFocused(true);
    
    // Only load data if we don't have any
    if (products.length === 0 && videoFeedData.length === 0) {
      loadData(false);
    }
    
    return () => {
      setIsScreenFocused(false);
    };
  }, [products.length, videoFeedData.length])  // Proper dependencies
);
```

---

## Phase 4: COMPONENT STRUCTURE VERIFICATION (30 minutes)

### 4.1 Check for Component Creation During Render
**File:** `App.tsx` or navigation configuration

**Critical issue from React Navigation docs:**
If you're defining components inline, React sees a "new component" and remounts.

**❌ WRONG:**
```typescript
<Stack.Screen 
  name="Home" 
  component={() => <HomeScreen />}  // New function every render!
/>
```

**✅ CORRECT:**
```typescript
<Stack.Screen 
  name="Home" 
  component={HomeScreen}  // Static reference
/>
```

**Action:** Search for any inline component definitions in navigation setup.

---

### 4.2 Verify HOC Usage
**❌ WRONG:**
```typescript
<Stack.Screen 
  name="Home" 
  component={withAuth(HomeScreen)}  // New HOC every render!
/>
```

**✅ CORRECT:**
```typescript
const AuthHomeScreen = withAuth(HomeScreen);  // Define outside component

// Later in navigator
<Stack.Screen 
  name="Home" 
  component={AuthHomeScreen}
/>
```

---

## Phase 5: TESTING & VERIFICATION (30 minutes)

### 5.1 Add Debug Markers
Temporarily add these to verify actual mounts vs re-renders:

```typescript
const HomeScreen = () => {
  const renderCount = useRef(0);
  renderCount.current++;
  
  useEffect(() => {
    console.log('🏠 HomeScreen MOUNTED');
    return () => console.log('🏠 HomeScreen UNMOUNTED');
  }, []);
  
  console.log(`🏠 HomeScreen RENDER #${renderCount.current}`);
  
  // ... rest of component
};
```

**Expected after fixes:**
- MOUNTED: Appears once when first opening app
- RENDER: Appears frequently (this is normal)
- UNMOUNTED: Never appears when switching tabs

---

### 5.2 Test Scenarios

| Test | Before Fix | After Fix |
|------|-----------|-----------|
| Switch to Home tab | Multiple "mounting" logs | Single "MOUNTED" log |
| Switch away from Home | Log spam continues | No logs (screen frozen) |
| Return to Home | More mounting logs | No mount log (already mounted) |
| Background app | AppState triggers reload | Debounced, minimal reloads |
| Context update | Full re-render cascade | Only affected components |

---

## Implementation Checklist

### Phase 1 (Do First)
- [ ] Add `enableFreeze(true)` to App.tsx (top of file)
- [ ] Fix misleading log in HomeScreen.tsx
- [ ] Add `freezeOnBlur: true` and `lazy: true` to BottomTab.Navigator

### Phase 2 (Do After Phase 1)
- [ ] Memoize FilterContext value with useMemo
- [ ] Memoize AuthContext value with useMemo
- [ ] Memoize CartContext value with useMemo

### Phase 3 (Do After Phase 2)
- [ ] Debounce AppState listener with 30-second threshold
- [ ] Consolidate duplicate useFocusEffect hooks

### Phase 4 (Do Last)
- [ ] Search for inline component definitions in navigation
- [ ] Fix any HOC usage that creates new instances

---

## Success Metrics

**Before:**
- "HomeScreen mounting" log appears 10+ times per minute
- CPU usage spikes when switching tabs
- Scroll position lost when returning to Home
- Video playback restarts unexpectedly

**After:**
- "HomeScreen MOUNTED" appears exactly once per app session
- No logs when switching tabs
- Scroll position preserved
- Videos continue playing in background (if desired)
- Smooth tab switching with no lag

---

## References

1. React Navigation Troubleshooting: https://reactnavigation.org/docs/troubleshooting/#screens-are-unmountingremounting-during-navigation
2. React Freeze Documentation: https://github.com/software-mansion/react-freeze
3. React Native Screens enableFreeze: https://github.com/software-mansion/react-native-screens#enablefreeze
4. Expo Router Issue #320 (similar problem): https://github.com/expo/router/issues/320
5. Stack Navigator freezeOnBlur: https://reactnavigation.org/docs/stack-navigator/#freezeonblur

---

## Estimated Time
- **Phase 1:** 30 minutes
- **Phase 2:** 60 minutes  
- **Phase 3:** 45 minutes
- **Phase 4:** 30 minutes
- **Phase 5:** 30 minutes

**Total: ~3.5 hours**

**Priority:** Phase 1 alone will fix 80% of the issue. Do Phase 1 first, then verify before proceeding.
