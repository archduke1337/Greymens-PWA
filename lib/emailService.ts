// lib/emailService.ts
// Email service for registration confirmations with e-ticket

// Generate a unique ticket ID
const generateTicketId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ticketId = 'TKT-';
  for (let i = 0; i < 8; i++) {
    ticketId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ticketId;
};

// Generate QR code URL (using free QR code API)
const generateQRCode = (ticketId: string): string => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketId)}`;
};

// Format date for email (e.g., "Monday, January 15, 2025")
const formatEventDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Send email using EmailJS
const sendEmailWithEmailJS = async (
  toEmail: string,
  toName: string,
  eventTitle: string,
  eventDate: string,
  eventTime: string,
  eventVenue: string,
  eventLocation: string,
  ticketId: string,
  qrCodeUrl: string,
  organizerName: string,
  eventPrice: number
): Promise<boolean> => {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const userId = process.env.NEXT_PUBLIC_EMAILJS_USER_ID;

  if (!serviceId || !templateId || !userId) {
    console.error('EmailJS configuration missing. Set NEXT_PUBLIC_EMAILJS_SERVICE_ID, NEXT_PUBLIC_EMAILJS_TEMPLATE_ID, and NEXT_PUBLIC_EMAILJS_USER_ID.');
    return false;
  }

  try {
    const formattedDate = formatEventDate(eventDate);

    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: userId,
        template_params: {
          to_email: toEmail,
          to_name: toName,
          event_title: eventTitle,
          event_date: formattedDate,
          event_time: eventTime,
          event_venue: eventVenue,
          event_location: eventLocation,
          ticket_id: ticketId,
          qr_code_url: qrCodeUrl,
          organizer_name: organizerName,
          event_price: eventPrice.toString(),
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
};

// Main function to send registration confirmation with e-ticket
export const sendRegistrationEmail = async (
  userEmail: string,
  userName: string,
  eventData: {
    title: string;
    date: string;
    time: string;
    venue: string;
    location: string;
    image?: string;
    organizerName: string;
    price: number;
    discountPrice?: number | null;
  }
): Promise<{ success: boolean; ticketId: string }> => {
  try {
    const ticketId = generateTicketId();
    const qrCodeUrl = generateQRCode(ticketId);
    const actualPrice = eventData.discountPrice || eventData.price;

    const sent = await sendEmailWithEmailJS(
      userEmail,
      userName,
      eventData.title,
      eventData.date,
      eventData.time,
      eventData.venue,
      eventData.location,
      ticketId,
      qrCodeUrl,
      eventData.organizerName,
      actualPrice
    );

    return { success: sent, ticketId };
  } catch (error) {
    console.error("Registration email failed:", error);
    const fallbackTicketId = generateTicketId();
    return { success: false, ticketId: fallbackTicketId };
  }
};

// Export helper functions for use elsewhere
export { generateTicketId, generateQRCode };
