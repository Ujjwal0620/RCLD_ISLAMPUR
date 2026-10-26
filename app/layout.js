import "./globals.css";

export const metadata = {
  title: "RCLD Islampur ERP",
  description: "Education institute ERP and LMS for RCLD Islampur",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
