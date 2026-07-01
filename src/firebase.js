import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
    apiKey: "AIzaSyCcsJSZoaVtBMi2dVVub4bXFno0qUS-UeY",
    authDomain: "my-ecofeast-app.firebaseapp.com",
    projectId: "my-ecofeast-app",
    storageBucket: "my-ecofeast-app.firebasestorage.app",
    messagingSenderId: "1091106196474",
    appId: "1:1091106196474:web:0eb44f1e04364cac787243",
    measurementId: "G-GHSTK97GR5"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

