import "./globals.css";

export const metadata = {
  title: "RCLD Islampur ERP",
  description: "RCLD Islampur education institute ERP",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
