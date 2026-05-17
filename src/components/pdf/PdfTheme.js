import { StyleSheet, Font } from '@react-pdf/renderer'

Font.register({
  family: 'DMSans',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/dmsans/v14/rP2Hp2ywxg089UriCZOIHQ.ttf' },
    { src: 'https://fonts.gstatic.com/s/dmsans/v14/rP2Cp2ywxg089UriASitCBimCw.ttf', fontWeight: 'bold' },
  ],
})

export const colors = {
  amber: '#F4BF4D',
  navy: '#0B1730',
  dark: '#111827',
  surface: '#1F2937',
  textPrimary: '#0F172A',
  textSecondary: '#6B7280',
  border: '#CBD5E1',
  green: '#10B981',
  red: '#EF4444',
  white: '#FFFFFF',
}

export const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: 'DMSans',
    fontSize: 10,
    color: colors.textPrimary,
    padding: 40,
    backgroundColor: colors.white,
  },
  headerBar: {
    backgroundColor: colors.navy,
    padding: 20,
    marginBottom: 24,
    borderRadius: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  logoPlaceholderText: {
    color: colors.dark,
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoImage: {
    width: 44,
    height: 44,
    marginRight: 14,
    objectFit: 'contain',
  },
  headerTextGroup: {
    flex: 1,
  },
  companyName: {
    color: colors.amber,
    fontSize: 18,
    fontWeight: 'bold',
  },
  companyTagline: {
    color: colors.white,
    fontSize: 9,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: `1px solid ${colors.border}`,
  },
  sectionRow: {
    marginBottom: 10,
  },
  label: {
    fontSize: 9,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  value: {
    fontSize: 9,
    color: colors.textPrimary,
  },
  table: {
    marginBottom: 16,
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `1px solid ${colors.border}`,
    paddingVertical: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.amber,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: colors.dark,
    fontSize: 8,
    fontWeight: 'bold',
    flex: 1,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
  },
  amountCell: {
    flex: 1,
    fontSize: 9,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#F8FAFC',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: `1px solid ${colors.border}`,
    paddingTop: 8,
    fontSize: 8,
    color: colors.textSecondary,
    textAlign: 'center',
  },
})
