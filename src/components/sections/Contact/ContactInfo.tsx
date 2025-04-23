import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

interface ContactInfoItemProps {
  icon: React.ReactNode;
  title: string;
  content: string;
  href?: string;
  delay: number;
}

function ContactInfoItem({ icon, title, content, href, delay }: ContactInfoItemProps) {
  const ContentWrapper = href ? 'a' : 'p';
  const props = href
    ? { href, className: 'text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors' }
    : { className: 'text-gray-600 dark:text-gray-400' };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="flex items-center gap-4 group"
    >
      <div className="w-12 h-12 bg-primary-50 dark:bg-gray-900 rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform duration-200">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-primary-500"
        >
          {icon}
        </motion.div>
      </div>
      <div>
        <h3 className="font-medium mb-1 text-gray-900 dark:text-gray-100">{title}</h3>
        <ContentWrapper {...props}>{content}</ContentWrapper>
      </div>
    </motion.div>
  );
}

export default function ContactInfo() {
  return (
    <div className="space-y-8">
      <ContactInfoItem
        icon={<Mail className="w-6 h-6" />}
        title="Email"
        content="leulman2@gmail.com"
        href="mailto:leulman2@gmail.com"
        delay={0.1}
      />
      
      <ContactInfoItem
        icon={<Phone className="w-6 h-6" />}
        title="Phone"
        content="+251 966 235 33"
        href="tel:+25196623533"
        delay={0.2}
      />
      
      <ContactInfoItem
        icon={<MapPin className="w-6 h-6" />}
        title="Location"
        content="Addis Ababa, Ethiopia"
        delay={0.3}
      />
    </div>
  );
}