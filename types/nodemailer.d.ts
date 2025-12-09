declare module "nodemailer" {
  import type SMTPTransport from "nodemailer/lib/smtp-transport"
  interface SendMailOptions extends SMTPTransport.Options {
    from?: string
    to?: string
    subject?: string
    html?: string
  }
  interface SentMessageInfo {
    messageId: string
    response: string
  }
  interface Transporter {
    sendMail(mailOptions: SendMailOptions): Promise<SentMessageInfo>
  }
  function createTransport(options: SMTPTransport.Options): Transporter
  export { createTransport }
  export type { SendMailOptions, SentMessageInfo, Transporter }
}
