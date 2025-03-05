import { useState } from 'react'
import PropTypes from 'prop-types'
import { Menu, Button, Dropdown } from 'antd'
import { CalendarOutlined, LoadingOutlined } from '@ant-design/icons'

const CalendarEventButton = ({ eventData }) => {
  const [loading, setLoading] = useState(false)

  const handleCalendarAction = async (type) => {
    setLoading(true)
    try {
      if (!eventData?.eventDetails) {
        throw new Error('No event details available')
      }
      
      const details = {
        title: eventData.eventDetails.title,
        date: eventData.eventDetails.date,
        time: eventData.eventDetails.time,
        description: eventData.eventDetails.description,
        location: eventData.eventDetails.location
      }

      let url
      switch (type) {
        case 'google':
          url = generateGoogleCalendarUrl(details)
          break
        case 'outlook':
          url = generateOutlookCalendarUrl(details)
          break
        case 'ical':
          url = generateICalendarUrl(details)
          break
        default:
          throw new Error('Unsupported calendar type')
      }

      window.electron.ipcRenderer.send('open-external', url)
    } catch (error) {
      console.error('Failed to create calendar event:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateGoogleCalendarUrl = (details) => {
    const baseUrl = 'https://calendar.google.com/calendar/render'
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: details.title,
      details: details.description,
      location: details.location || '',
      dates: formatDatesForGoogle(details.date, details.time)
    })
    return `${baseUrl}?${params.toString()}`
  }

  const generateOutlookCalendarUrl = (details) => {
    const baseUrl = 'https://outlook.live.com/calendar/0/deeplink/compose'
    const params = new URLSearchParams({
      subject: details.title,
      body: details.description,
      location: details.location || '',
      startdt: formatDatesForOutlook(details.date, details.time)
    })
    return `${baseUrl}?${params.toString()}`
  }

  const generateICalendarUrl = (details) => {
    const icsContent = generateICSContent(details)
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    return URL.createObjectURL(blob)
  }

  const formatDatesForGoogle = (date, time) => {
    let start, end
    
    // Parse the standardized date from LLM (YYYY-MM-DD format)
    const [year, month, day] = date.split('-')
    start = new Date(year, month - 1, day)
    
    // Parse the standardized time (HH:MM format)
    const [hours, minutes] = time.split(':')
    start.setHours(parseInt(hours), parseInt(minutes))
    
    // Default duration: 1 hour
    end = new Date(start.getTime() + 60 * 60 * 1000)
    
    return `${start.toISOString().replace(/[-:]/g, '')}/${end.toISOString().replace(/[-:]/g, '')}`
  }

  const formatDatesForOutlook = (date, time) => {
    const [year, month, day] = date.split('-')
    const startDate = new Date(year, month - 1, day)
    const [hours, minutes] = time.split(':')
    startDate.setHours(parseInt(hours), parseInt(minutes))
    return startDate.toISOString()
  }

  const generateICSContent = (details) => {
    const [year, month, day] = details.date.split('-')
    const [hours, minutes] = details.time.split(':')
    const start = new Date(year, month - 1, day)
    start.setHours(parseInt(hours), parseInt(minutes))
    const end = new Date(start.getTime() + 60 * 60 * 1000)

    const location = details.location ? `\nLOCATION:${details.location}` : ''
    
    return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${start.toISOString().replace(/[-:]/g, '')}
DTEND:${end.toISOString().replace(/[-:]/g, '')}
SUMMARY:${details.title}${location}
DESCRIPTION:${details.description}
END:VEVENT
END:VCALENDAR`
  }

  const menu = (
    <Menu>
      <Menu.Item key="google" onClick={() => handleCalendarAction('google')}>
        Add to Google Calendar
      </Menu.Item>
      <Menu.Item key="outlook" onClick={() => handleCalendarAction('outlook')}>
        Add to Outlook Calendar
      </Menu.Item>
      <Menu.Item key="ical" onClick={() => handleCalendarAction('ical')}>
        Download ICS File
      </Menu.Item>
    </Menu>
  )

  // Only show the button if we have event details
  if (!eventData?.eventDetails) {
    return null
  }

  return (
    <Dropdown overlay={menu} placement="bottomRight">
      <Button 
        type="text" 
        icon={loading ? <LoadingOutlined /> : <CalendarOutlined />}
        disabled={loading}
      >
        Add to Calendar
      </Button>
    </Dropdown>
  )
}

CalendarEventButton.propTypes = {
  eventData: PropTypes.shape({
    eventDetails: PropTypes.shape({
      title: PropTypes.string.isRequired,
      date: PropTypes.string.isRequired,
      time: PropTypes.string.isRequired,
      description: PropTypes.string,
      location: PropTypes.string
    })
  }).isRequired
}

export default CalendarEventButton