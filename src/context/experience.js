import {createContext,useContext} from 'react';
// Keep context identity separate from refreshable provider components.
export const ExperienceContext=createContext();
export const useExperience=()=>useContext(ExperienceContext);
