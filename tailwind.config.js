/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./src/renderer/index.html",
        "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    DEFAULT: '#25d366',
                    dark: '#128c7e',
                }
            }
        },
    },
    plugins: [],
}
