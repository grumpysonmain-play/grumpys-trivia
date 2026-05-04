const firebaseConfig = {
  apiKey: "AIzaSyBjtHzPLiLV_dTpsK7NYzWKHW9HXFCL9yU",
  authDomain: "grumpys-trivia.firebaseapp.com",
  databaseURL: "https://grumpys-trivia-default-rtdb.firebaseio.com",
  projectId: "grumpys-trivia",
  storageBucket: "grumpys-trivia.firebasestorage.app",
  messagingSenderId: "889822848857",
  appId: "1:889822848857:web:7b978144720d2e7a4f8e48",
  measurementId: "G-T1W57YPNXG"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
