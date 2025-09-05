import { useReducer, useContext, createContext, createElement } from "react";
import type { Dispatch, ReactNode } from "react";

export type InterviewState = {
  answers: Record<string, any>;
};

export type InterviewAction =
  | { type: "SET_ANSWER"; step: string; answer: any }
  | { type: "RESET" };

const initialState: InterviewState = {
  answers: {},
};

function interviewReducer(state: InterviewState, action: InterviewAction): InterviewState {
  switch (action.type) {
    case "SET_ANSWER":
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.step]: action.answer,
        },
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const InterviewContext = createContext<{
  state: InterviewState;
  dispatch: Dispatch<InterviewAction>;
} | null>(null);

export function InterviewProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(interviewReducer, initialState);
  return createElement(InterviewContext.Provider, { value: { state, dispatch } }, children);
}

export function useInterview() {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error("useInterview must be used within an InterviewProvider");
  }
  return context;
}
