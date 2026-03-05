// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAutovMl_ObLrnFPlx52tv046bXgP5REew",
  authDomain: "comunicacaoiasd-deafd.firebaseapp.com",
  projectId: "comunicacaoiasd-deafd",
  storageBucket: "comunicacaoiasd-deafd.firebasestorage.app",
  messagingSenderId: "574976826729",
  appId: "1:574976826729:web:39400c3f629c821b5ff1f8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);