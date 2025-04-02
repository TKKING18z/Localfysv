import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';

interface FAQItemProps {
    question: string;
    answer: string;
    isOpen: boolean;
    onToggle: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, isOpen, onToggle }) => {
    return (
        <View style={styles.faqItem}>
            <TouchableOpacity style={styles.questionContainer} onPress={onToggle}>
                <Text style={styles.questionText}>{question}</Text>
                <Text style={styles.toggleIcon}>{isOpen ? '-' : '+'}</Text>
            </TouchableOpacity>
            {isOpen && (
                <View style={styles.answerContainer}>
                    <Text style={styles.answerText}>{answer}</Text>
                </View>
            )}
        </View>
    );
};

const FAQsScreen: React.FC = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const faqs = [
        {
            question: '¿Qué es Localfy?',
            answer: 'Localfy es una aplicación que te permite descubrir negocios locales, ver su información detallada, horarios, productos o servicios ofrecidos y más.'
        },
        {
            question: '¿Cómo encuentro negocios cercanos?',
            answer: 'Puedes buscar negocios por categoría, ubicación o mediante el mapa interactivo que muestra los negocios cercanos a tu ubicación actual.'
        },
        {
            question: '¿Cómo veo los detalles de un negocio?',
            answer: 'Simplemente toca el negocio que te interesa en la lista o en el mapa para acceder a su perfil completo con toda la información disponible.'
        },
        {
            question: '¿Puedo guardar mis negocios favoritos?',
            answer: 'Sí, puedes marcar negocios como favoritos para acceder rápidamente a ellos en cualquier momento desde la sección de favoritos.'
        },
        {
            question: '¿Cómo contacto a un negocio?',
            answer: 'En el perfil de cada negocio encontrarás opciones para llamar, enviar un mensaje, visitar su sitio web o navegar hasta su ubicación física.'
        },
        {
            question: '¿La información está actualizada?',
            answer: 'Trabajamos con los dueños de negocios para mantener la información lo más actualizada posible. La última fecha de actualización se muestra en cada perfil.'
        },
        {
            question: '¿Cómo puedo reportar información incorrecta?',
            answer: 'En cada perfil de negocio hay una opción para reportar información incorrecta o desactualizada. Nuestro equipo revisará y actualizará la información.'
        },
        {
            question: '¿Puedo agregar mi negocio a Localfy?',
            answer: 'Sí, los dueños de negocios pueden registrarse y crear un perfil para su negocio. Visita la sección "Agregar mi negocio" en el menú principal.'
        },
        {
            question: '¿Es gratis usar Localfy?',
            answer: 'Sí, Localfy es completamente gratuito para los usuarios que buscan información sobre negocios.'
        },
        {
            question: '¿Necesito una cuenta para usar la app?',
            answer: 'Puedes navegar y buscar negocios sin una cuenta, pero necesitarás registrarte para guardar favoritos o dejar reseñas.'
        }
    ];

    const toggleFAQ = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Preguntas Frecuentes</Text>
                    <Text style={styles.headerSubtitle}>Todo lo que necesitas saber sobre Localfy</Text>
                </View>
                <View style={styles.faqContainer}>
                    {faqs.map((faq, index) => (
                        <FAQItem
                            key={index}
                            question={faq.question}
                            answer={faq.answer}
                            isOpen={openIndex === index}
                            onToggle={() => toggleFAQ(index)}
                        />
                    ))}
                </View>
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        ¿No encuentras la respuesta que buscas? Contáctanos a través de support@localfy.com
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        padding: 20,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    faqContainer: {
        padding: 15,
    },
    faqItem: {
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    questionContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
    },
    questionText: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        color: '#333',
    },
    toggleIcon: {
        fontSize: 24,
        fontWeight: '700',
        color: '#666',
        paddingHorizontal: 8,
    },
    answerContainer: {
        padding: 15,
        paddingTop: 0,
        backgroundColor: '#fafafa',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    answerText: {
        fontSize: 15,
        color: '#555',
        lineHeight: 22,
    },
    footer: {
        padding: 20,
        alignItems: 'center',
        marginBottom: 20,
    },
    footerText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
});

export default FAQsScreen;