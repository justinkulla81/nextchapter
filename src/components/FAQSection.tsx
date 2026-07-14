import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { FAQ_CATEGORIES } from './faq-data'

export function FAQSection() {
  return (
    <div className="space-y-10">
      {FAQ_CATEGORIES.map((category) => (
        <div key={category.category}>
          <h3 className="text-sm font-semibold tracking-wide text-brand uppercase">
            {category.category}
          </h3>
          <Accordion className="mt-4">
            {category.items.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  )
}
