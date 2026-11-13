import "./globals.css";
import "./styles/design-system.css";
import "./styles/public-home.css";
import "./styles/registration-print.css";

export const metadata = {
  title: "RCLD Islampur ERP",
  description: "RCLD Islampur education institute ERP",
  icons: {
    icon: [{ url: "/assets/logo.png", type: "image/png" }],
    shortcut: ["/assets/logo.png"],
    apple: ["/assets/logo.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
