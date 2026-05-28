// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC5FT0W82XgYN7QsJxW9HIeDHGs_HfTTNg",
  authDomain: "vibemenu-55f2a.firebaseapp.com",
  projectId: "vibemenu-55f2a",
  storageBucket: "vibemenu-55f2a.firebasestorage.app",
  messagingSenderId: "722324150183",
  appId: "1:722324150183:web:6d8dc9f64a696df7710882",
  measurementId: "G-CGGQJQF4LW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);