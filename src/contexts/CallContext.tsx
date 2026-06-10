import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { realtimeAPI } from '../services/realtimeAPI';
import { chatAPI } from '../services/chatAPI';
import { callkeepService } from '../services/callkeepService';

export interface IncomingCallInfo {
  callSessionId: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'audio' | 'video';
  conversationId: string;
  initiatorId?: string;
}

interface CallContextValue {
  incomingCallForBanner: IncomingCallInfo | null;
  registerActiveChatId: (chatId: string) => void;
  unregisterActiveChatId: () => void;
  declineCallFromBanner: () => void;
  clearBannerCall: () => void;
}

const CallContext = createContext<CallContextValue>({
  incomingCallForBanner: null,
  registerActiveChatId: () => {},
  unregisterActiveChatId: () => {},
  declineCallFromBanner: () => {},
  clearBannerCall: () => {},
});

export const useCallContext = () => useContext(CallContext);

export const CallProvider: React.FC<{
  children: React.ReactNode;
  navigationRef?: React.RefObject<any>;
}> = ({ children, navigationRef }) => {
  const { user } = useAuth();

  const [incomingCallForBanner, setIncomingCallForBanner] = useState<IncomingCallInfo | null>(null);

  // Use refs so the subscribe callback never goes stale
  const activeChatIdRef = useRef<string | null>(null);
  const incomingCallRef = useRef<IncomingCallInfo | null>(null);
  const userIdRef = useRef<string | undefined>(user?.id);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const registerActiveChatId = useCallback((chatId: string) => {
    activeChatIdRef.current = chatId;
  }, []);

  const unregisterActiveChatId = useCallback(() => {
    activeChatIdRef.current = null;
  }, []);

  const clearBannerCall = useCallback(() => {
    const call = incomingCallRef.current;
    if (call) {
      callkeepService.endCallkeepCall(call.callSessionId);
    }
    incomingCallRef.current = null;
    setIncomingCallForBanner(null);
  }, []);

  const declineCallFromBanner = useCallback(() => {
    const call = incomingCallRef.current;
    if (!call) return;

    if (realtimeAPI.isConnected()) {
      realtimeAPI.sendCallSignal(
        call.callSessionId,
        'call_declined',
        { declinedBy: userIdRef.current, timestamp: new Date().toISOString() },
        call.conversationId,
      );
    }
    chatAPI.endCall(call.callSessionId, 'declined');
    callkeepService.endCallkeepCall(call.callSessionId);

    incomingCallRef.current = null;
    setIncomingCallForBanner(null);
  }, []);

  // Initialise CallKeep once and register system-UI handlers
  useEffect(() => {
    // Native UI → Accept: navigate to the chat and show the full-screen modal
    callkeepService.onAnswerCall((callUUID) => {
      const info = callkeepService.getCallInfo(callUUID);
      if (!info) return;

      // Clear the banner (in case it was visible)
      incomingCallRef.current = null;
      setIncomingCallForBanner(null);

      // Navigate to IndividualChatScreen with the pending call info
      navigationRef?.current?.navigate('IndividualChatScreen', {
        chatId: info.conversationId,
        chatName: info.callerName,
        chatAvatar: null,
        chatType: 'friend',
        pendingIncomingCall: {
          callSessionId: info.callSessionId,
          callerName: info.callerName,
          callType: info.callType,
        },
      });
    });

    // Native UI → Decline: send signal and clear state
    callkeepService.onEndCall((callUUID) => {
      const info = callkeepService.getCallInfo(callUUID);
      if (!info) return;

      if (realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(
          info.callSessionId,
          'call_declined',
          { declinedBy: userIdRef.current, timestamp: new Date().toISOString() },
          info.conversationId,
        );
      }
      chatAPI.endCall(info.callSessionId, 'declined');

      incomingCallRef.current = null;
      setIncomingCallForBanner(null);
    });

    return () => {
      callkeepService.teardown();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = realtimeAPI.subscribe('call_event', (data) => {
      const { eventType, callData, conversationId } = data;

      if (eventType === 'incoming_call') {
        // Ignore if the current user is the one initiating the call
        if (callData?.initiator?.id === userIdRef.current) return;

        // Ignore if we already have a pending incoming call (banner or native UI)
        if (incomingCallRef.current) return;

        const callConvId = conversationId || callData?.conversationId;

        const info: IncomingCallInfo = {
          callSessionId: callData.callSessionId,
          callerName:
            callData.initiator?.full_name ||
            callData.initiator?.username ||
            'Unknown Caller',
          callerAvatar: callData.initiator?.avatar_url || callData.initiator?.profile_picture,
          callType: callData.callType,
          conversationId: callConvId,
          initiatorId: callData.initiator?.id,
        };

        incomingCallRef.current = info;
        // Only show the in-app banner when the relevant chat is NOT already open.
        // The native system UI (CallKeep) will still be shown for all incoming calls
        // so the device's regular ringtone is used consistently.
        if (!activeChatIdRef.current || activeChatIdRef.current !== callConvId) {
          setIncomingCallForBanner(info);
        }

        // Also show the native system call UI (handles lock-screen / background)
        callkeepService.displayIncomingCall({
          uuid: info.callSessionId,
          callerName: info.callerName,
          callType: info.callType,
          conversationId: info.conversationId,
          callSessionId: info.callSessionId,
        });

      } else if (eventType === 'call_ended') {
        // Dismiss banner and native call UI for any active incoming call
        if (incomingCallRef.current) {
          callkeepService.endCallkeepCall(incomingCallRef.current.callSessionId);
          incomingCallRef.current = null;
          setIncomingCallForBanner(null);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []); // Empty deps — all values read via refs

  return (
    <CallContext.Provider
      value={{
        incomingCallForBanner,
        registerActiveChatId,
        unregisterActiveChatId,
        declineCallFromBanner,
        clearBannerCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
