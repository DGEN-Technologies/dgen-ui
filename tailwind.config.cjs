/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,svelte}"],
  plugins: [require("tailwind-scrollbar"), require("daisyui")],
  theme: {
    extend: {
      colors: {
        // DGEN brand colors - matching logo gradient
        "dgen-aqua": "#74EBD5",
        "dgen-purple": "#9688DD",
        "dgen-cyan": "#5FE5D0",
        "dgen-teal": "#6AEEC7",
        "dgen-lavender": "#B8A9E8",
        // Legacy colors for compatibility
        "gradient-start": "#74EBD5",
        "gradient-mid": "#6AEEC7",
        "gradient-end": "#5FE5D0",
        "accent-start": "#74EBD5",
        "accent-end": "#5FE5D0",
        "solana-purple": "#9688DD",
        "solana-green": "#74EBD5",
        "solana-cyan": "#5FE5D0",
      },
      backgroundImage: {
        // Primary gradient - more aqua, less purple (matching logo)
        "gradient-primary":
          "linear-gradient(90deg, #74EBD5 0%, #6AEEC7 40%, #9688DD 100%)",
        // Secondary gradient - pure aqua/teal
        "gradient-secondary":
          "linear-gradient(135deg, #74EBD5 0%, #5FE5D0 100%)",
        // Accent gradient - aqua to light purple
        "gradient-accent": "linear-gradient(135deg, #74EBD5 0%, #B8A9E8 100%)",
        "gradient-dark": "linear-gradient(135deg, #0a0a0f 0%, #161621 100%)",
        // DGEN brand gradient - exactly matching logo
        "gradient-dgen": "linear-gradient(90deg, #74EBD5 0%, #9688DD 100%)",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s infinite",
        float: "float 3s ease-in-out infinite",
        "gradient-shift": "gradient-shift 3s ease infinite",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  daisyui: {
    themes: [
      {
        light: {
          ...require("daisyui/src/theming/themes").lofi,
          gradient: "#C3CFE2",
          error: "#b91c1c",
        },
      },
      {
        dark: {
          ...require("daisyui/src/theming/themes").black,
          secondary: "#CCC",
          gradient: "#C3CFE2",
          error: "#f87171",
        },
      },
      {
        modern: {
          primary: "#74EBD5",  // Changed from purple to aqua as primary
          "primary-content": "#000000",
          secondary: "#9688DD",  // Purple is now secondary (less prominent)
          "secondary-content": "#ffffff",
          accent: "#5FE5D0",  // Lighter aqua/cyan accent
          "accent-content": "#000000",
          neutral: "#0a0a0f",
          "neutral-content": "#ffffff",
          "base-100": "rgba(10, 10, 15, 0.95)",
          "base-200": "rgba(22, 22, 33, 0.9)",
          "base-300": "rgba(35, 35, 50, 0.8)",
          "base-content": "#e0e0e0",
          info: "#74EBD5",  // Aqua for info
          success: "#6AEEC7",  // Teal for success
          warning: "#FFD700",
          error: "#FF4747",
          "--rounded-box": "1.5rem",
          "--rounded-btn": "1rem",
          "--rounded-badge": "1.9rem",
          "--animation-btn": "0.3s",
          "--animation-input": "0.2s",
          "--btn-focus-scale": "0.98",
          "--border-btn": "1px",
          "--tab-border": "1px",
          "--tab-radius": "0.5rem",
        },
      },
    ], // false: only light + dark | true: all themes | array: specific themes like this ["light", "dark", "cupcake"]
    darkTheme: "modern", // name of one of the included themes for dark mode
    base: true, // applies background color and foreground color for root element by default
    styled: true, // include daisyUI colors and design decisions for all components
    utils: true, // adds responsive and modifier utility classes
    prefix: "", // prefix for daisyUI classnames (components, modifiers and responsive class names. Not colors)
    logs: false, // Shows info about daisyUI version and used config in the console when building your CSS
    themeRoot: ":root", // The element that receives theme color CSS variables
  },
  safelist: ["w-16", "h-16", "w-20", "h-20", "w-24", "h-24"],
};
